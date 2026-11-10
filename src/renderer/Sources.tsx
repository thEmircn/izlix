import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { highlightLine, initState, langOf, type HlState } from '../shared/highlight'
import { buildNetworkRows } from '../shared/network'
import { toast, useStore, useT } from './store'
import { Seg } from './ui'

interface OrigSource { name: string; content: string | null }
interface Bundle { url: string; code: string; mapUrl?: string; sources: OrigSource[]; truncated: boolean }
interface FileView { name: string; text: string | null; path?: string }
const ROW = 18
const norm = (p: string): string => p.replace(/\\/g, '/').replace(/^\.?\/+/, '')
/** Iki dosya yolu ayni dosyayi mi gosteriyor (biri digerinin sonu; mutlak/goreli farki onemsiz) */
const sameFile = (a: string, b: string): boolean => { const x = norm(a), y = norm(b); return !!x && !!y && (x === y || x.endsWith('/' + y) || y.endsWith('/' + x)) }

/** Sources: yuklenen betikler, source map ile orijinal dosyalar, sozdizimi renklendirme ve arama. Salt okunur. */
export function Sources({ events }: { events: BusEvent[] }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const editor = useStore((s) => s.editor)
  const target = useStore((s) => s.sourceTarget)
  const [q, setQ] = useState('')
  const [bundles, setBundles] = useState<Record<string, Bundle | 'loading' | null>>({})
  const [open, setOpen] = useState<string | null>(null)       // secili betik URL'si
  const [file, setFile] = useState<FileView | null>(null)
  const [jump, setJump] = useState<number | null>(null)
  const bps = useStore((s) => s.bps)
  const paused = useStore((s) => s.paused)
  const [exc, setExc] = useState<'none' | 'uncaught' | 'all'>('none')
  const [cond, setCond] = useState<{ line: number; text: string } | null>(null)

  // Debugger alani yalnizca bu panel aciksa etkindir (sayfa yukleme maliyeti); kapaninca duraklama surdurulur
  useEffect(() => {
    if (!tabId) return
    let live = true
    void window.izlix.dbgEnable(tabId).then(async () => {
      if (!live) return
      for (const b of useStore.getState().bps.filter((x) => x.tabId === tabId)) { // onceki kesme noktalarini yeniden uygula
        const r: any = await window.izlix.dbgSetBp(tabId, b.kind === 'file' ? { file: b.target, line: b.line, condition: b.condition } : { url: b.target, line: b.line, condition: b.condition })
        if (r?.id) useStore.setState((st) => ({ bps: st.bps.map((x) => (x === b ? { ...x, bpId: r.id } : x)) }))
      }
    })
    const off = window.izlix.onDbg((e: any) => {
      if (e.id !== useStore.getState().activeTabId) return
      if (e.type === 'paused') useStore.setState({ paused: { tabId: e.id, reason: e.reason, frames: e.frames, sel: 0 } })
      else useStore.setState({ paused: null })
    })
    return () => { live = false; off(); useStore.setState({ paused: null }); void window.izlix.dbgDisable(tabId) }
  }, [tabId])

  // duraklayinca ust cercevenin dosyasini ac
  useEffect(() => {
    if (!paused || paused.tabId !== tabId) return
    const f = paused.frames[paused.sel]
    if (f?.url) void pickScript(f.url, f.orig?.line ?? f.line, f.orig?.file)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paused?.sel, paused?.frames])
  // klavye: F8 surdur, F10 uzerinden, F11 icine (+shift: disina)
  useEffect(() => {
    const h = (e: KeyboardEvent): void => {
      if (!tabId || !useStore.getState().paused) return
      const cmd = e.key === 'F8' ? 'resume' : e.key === 'F10' ? 'stepOver' : e.key === 'F11' ? (e.shiftKey ? 'stepOut' : 'stepInto') : null
      if (cmd) { e.preventDefault(); void window.izlix.dbgControl(tabId, cmd) }
    }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [tabId])

  const curBp = (kind: 'file' | 'url', target: string, line: number) => bps.find((b) => b.tabId === tabId && b.kind === kind && b.target === target && b.line === line)
  const toggleBp = async (kind: 'file' | 'url', target: string, line: number, condition?: string): Promise<void> => {
    if (!tabId) return
    const ex = curBp(kind, target, line)
    if (ex) { if (ex.bpId) await window.izlix.dbgRemoveBp(tabId, ex.bpId); useStore.setState((st) => ({ bps: st.bps.filter((x) => x !== ex) })); return }
    const r: any = await window.izlix.dbgSetBp(tabId, kind === 'file' ? { file: target, line, condition } : { url: target, line, condition })
    if (r?.id) useStore.setState((st) => ({ bps: [...st.bps, { tabId, kind, target, line, condition, bpId: r.id }] }))
    else toast(r?.error === 'unmapped' ? t('dbg.unmapped') : t('dbg.bpFail'))
  }

  const scripts = useMemo(() => {
    const rows = buildNetworkRows(events).filter((r) => (r.type === 'js' || r.type === 'css') && r.status != null && r.status < 400)
    const seen = new Set<string>()
    return rows.filter((r) => { const k = r.url.split('?')[0]; if (seen.has(k)) return false; seen.add(k); return true })
  }, [events])
  const shown = scripts.filter((r) => !q || r.url.toLowerCase().includes(q.toLowerCase()))

  const load = async (url: string): Promise<Bundle | null> => {
    if (!tabId) return null
    const cached = bundles[url]
    if (cached && cached !== 'loading') return cached
    setBundles((b) => ({ ...b, [url]: 'loading' }))
    const b: Bundle | null = await window.izlix.loadSource(tabId, url)
    setBundles((x) => ({ ...x, [url]: b }))
    return b
  }
  const isApp = (n: string): boolean => !/node_modules|^\(webpack\)|\/\.vite\/|__vite|\[turbopack\]/.test(n)
  const pickScript = async (url: string, line?: number, orig?: string): Promise<void> => {
    setOpen(url)
    const b = await load(url)
    if (!b) { setFile(null); return }
    const o = orig ? b.sources.find((s) => sameFile(s.name, orig)) : null
    const first = b.sources.find((s) => s.content != null && isApp(s.name))
    if (o) setFile({ name: o.name, text: o.content }); else if (!orig && first) setFile({ name: first.name, text: first.content }); else setFile({ name: url.split('/').pop() ?? url, text: b.code })
    setJump(line ?? null)
  }

  // konsol stack'inden gelen istek: uretilen konumu orijinale cevir
  useEffect(() => {
    if (!target || !tabId) return
    void (async () => {
      const pos: any = await window.izlix.sourcePos(tabId, target.url, target.line, target.col)
      await pickScript(target.url, pos?.line ?? target.line, pos?.file)
      useStore.getState().set({ sourceTarget: null })
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target])

  const b = open ? bundles[open] : null
  return (
    <div className="sources">
      <div className="srcside">
        <input className="search" placeholder={t('src.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="srclist">
          {shown.map((r) => {
            const k = r.url, bb = bundles[k]
            return (
              <div key={k}>
                <div className={`srcitem ${open === k ? 'on' : ''}`} onClick={() => void pickScript(k)} title={r.url}><span className="nm">{r.name.replace(/\?.*$/, '')}</span><i>{r.host}</i></div>
                {open === k && bb && bb !== 'loading' && (
                  <div className="srcsub">
                    {bb.sources.filter((s) => isApp(s.name)).slice(0, 80).map((s) => <div key={s.name} className={`srcitem sub ${file?.name === s.name ? 'on' : ''}`} onClick={() => setFile({ name: s.name, text: s.content })} title={s.name}>{s.name.split('/').slice(-2).join('/')}</div>)}
                    <div className={`srcitem sub dim ${file?.text === bb.code ? 'on' : ''}`} onClick={() => setFile({ name: r.name, text: bb.code })}>{t('src.bundle')}</div>
                  </div>
                )}
              </div>
            )
          })}
          {!shown.length && <div className="empty-hint">{t('net.empty')}</div>}
        </div>
      </div>
      <div className="srcview">
        {!open && <div className="empty-hint">{t('src.pick')}</div>}
        {open && b === 'loading' && <div className="skeleton" style={{ height: 80, margin: 12 }} />}
        {open && b && b !== 'loading' && !b.sources.length && <div className="snapbar" style={{ background: 'transparent', color: 'var(--dim)', borderColor: 'var(--line)' }}>{t('src.noMap')}</div>}
        {tabId && (
          <div className="dbgbar">
            {paused && paused.tabId === tabId ? (
              <>
                <span className="pausedbadge">{t('dbg.paused')} · {paused.reason}</span>
                <button className="btn sm" title="F8" onClick={() => void window.izlix.dbgControl(tabId, 'resume')}>{t('dbg.resume')}</button>
                <button className="btn sm" title="F10" onClick={() => void window.izlix.dbgControl(tabId, 'stepOver')}>{t('dbg.over')}</button>
                <button className="btn sm" title="F11" onClick={() => void window.izlix.dbgControl(tabId, 'stepInto')}>{t('dbg.into')}</button>
                <button className="btn sm" title="⇧F11" onClick={() => void window.izlix.dbgControl(tabId, 'stepOut')}>{t('dbg.out')}</button>
              </>
            ) : <span className="dimtxt">{t('dbg.hint')}</span>}
            <span style={{ flex: 1 }} />
            <select className="mini-select" value={exc} title={t('dbg.excTitle')} onChange={(e) => { const v = e.target.value as 'none' | 'uncaught' | 'all'; setExc(v); void window.izlix.dbgExceptions(tabId, v) }}>
              <option value="none">{t('dbg.excNone')}</option><option value="uncaught">{t('dbg.excUncaught')}</option><option value="all">{t('dbg.excAll')}</option>
            </select>
          </div>
        )}
        {cond && <div className="dbgbar"><span className="dimtxt">{t('dbg.condition', { n: cond.line })}</span>
          <input className="search" autoFocus value={cond.text} placeholder="i > 3" onChange={(e) => setCond({ ...cond, text: e.target.value })}
            onKeyDown={(e) => { if (e.key === 'Escape') setCond(null); if (e.key === 'Enter' && file && open) { const isBundle = !!(b && b !== 'loading' && file.text === b.code); void toggleBp(isBundle ? 'url' : 'file', isBundle ? open : file.name, cond.line, cond.text.trim() || undefined); setCond(null) } }} /></div>}
        {file && (() => {
          const isBundle = !!(b && b !== 'loading' && file.text === b.code)
          const kind = isBundle ? 'url' : 'file', target = isBundle ? (open as string) : file.name
          const pf = paused && paused.tabId === tabId ? paused.frames[paused.sel] : null
          const pausedLine = pf && ((pf.orig && !isBundle && sameFile(file.name, pf.orig.file)) ? pf.orig.line : (pf.url.split('?')[0] === (open ?? '').split('?')[0] && isBundle ? pf.line : null))
          return <CodeView key={file.name} file={file} jump={jump} editor={editor} truncated={!!(b && b !== 'loading' && b.truncated && file.text === b.code)}
            bpLines={new Set(bps.filter((x) => x.tabId === tabId && x.kind === kind && x.target === target).map((x) => x.line))} pausedLine={pausedLine ?? null}
            onGutter={(line, alt) => { if (alt) setCond({ line, text: '' }); else void toggleBp(kind, target, line) }} />
        })()}
        {paused && paused.tabId === tabId && tabId && <DbgPanel tabId={tabId} paused={paused} />}
      </div>
    </div>
  )
}

function CodeView({ file, jump, editor, truncated, bpLines, pausedLine, onGutter }: { file: FileView; jump: number | null; editor: string; truncated: boolean; bpLines: Set<number>; pausedLine: number | null; onGutter(line: number, alt: boolean): void }) {
  const t = useT()
  const box = useRef<HTMLDivElement>(null)
  const [scroll, setScroll] = useState(0)
  const [q, setQ] = useState('')
  const [hit, setHit] = useState(0)
  const lines = useMemo(() => (file.text ?? '').split('\n'), [file.text])
  const lang = langOf(file.name)
  // her satirin basindaki blok-yorum durumu (renklendirme sanallastirilmis oldugu icin once taranir)
  const blockAt = useMemo(() => { const st: HlState = initState(); const a: boolean[] = new Array(lines.length); for (let i = 0; i < lines.length; i++) { a[i] = st.block; highlightLine(lines[i], st, lang) } return a }, [lines, lang])
  const matches = useMemo(() => { const n = q.trim().toLowerCase(); if (!n) return [] as number[]; const out: number[] = []; for (let i = 0; i < lines.length && out.length < 2000; i++) if (lines[i].toLowerCase().includes(n)) out.push(i); return out }, [lines, q])
  const goto = (line0: number): void => { box.current?.scrollTo({ top: Math.max(0, line0 * ROW - 120), behavior: 'smooth' }) }
  useEffect(() => { if (jump) setTimeout(() => goto(jump - 1), 60) }, [jump, file.name])
  useEffect(() => { if (pausedLine) goto(pausedLine - 1) }, [pausedLine])
  useEffect(() => { if (matches.length) { setHit(0); goto(matches[0]) } }, [q])
  const first = Math.max(0, Math.floor(scroll / ROW) - 20), last = Math.min(lines.length, Math.ceil((scroll + 1200) / ROW) + 20)
  if (file.text == null) return <div className="empty-hint">{t('src.noContent')}</div>
  return (
    <div className="codeview">
      <div className="codebar">
        <b title={file.name}>{file.name.split('/').slice(-2).join('/')}</b><span className="dimtxt">{t('src.lines', { n: lines.length })}</span><span style={{ flex: 1 }} />
        <input className="search" style={{ maxWidth: 150 }} placeholder={t('src.find')} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && matches.length) { const n = (hit + (e.shiftKey ? -1 : 1) + matches.length) % matches.length; setHit(n); goto(matches[n]) } }} />
        {q && <span className="dimtxt">{matches.length ? `${hit + 1}/${matches.length}` : '0'}</span>}
        {file.name.startsWith('/') && <button className="btn sm" onClick={() => void window.izlix.openSource({ file: file.name, line: jump ?? 1, editor })}>{t('src.openEditor')}</button>}
      </div>
      {truncated && <div className="dimtxt" style={{ padding: '2px 12px' }}>{t('src.truncated')}</div>}
      <div className="codebody" ref={box} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
        <div style={{ height: lines.length * ROW, position: 'relative' }}>
          {lines.slice(first, last).map((ln, k) => {
            const i = first + k
            const st: HlState = { block: blockAt[i] }
            const toks = highlightLine(ln, st, lang)
            const isHit = matches.includes(i)
            return (
              <div key={i} className={`cl ${jump === i + 1 ? 'jump' : ''} ${isHit ? 'hit' : ''} ${pausedLine === i + 1 ? 'pausedline' : ''}`} style={{ top: i * ROW }}>
                <span className={`ln ${bpLines.has(i + 1) ? 'bp' : ''}`} onClick={(e) => onGutter(i + 1, e.altKey || e.shiftKey)} title="Click: breakpoint · Alt/Shift+click: conditional">{i + 1}</span>
                <span className="lc">{toks.map((tk, j) => <span key={j} className={`tk-${tk.t}`}>{tk.s}</span>)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}


/** Duraklayinca: cagri yigini, kapsam degiskenleri (genisletilebilir), cercevede degerlendirme */
function DbgPanel({ tabId, paused }: { tabId: string; paused: { frames: any[]; sel: number } }) {
  const t = useT()
  const [tab, setTab] = useState<'stack' | 'scope' | 'eval'>('scope')
  const frame = paused.frames[paused.sel]
  return (
    <div className="dbgpanel">
      <Seg<'stack' | 'scope' | 'eval'> small value={tab} onChange={setTab} items={[{ key: 'scope', label: t('dbg.scope') }, { key: 'stack', label: `${t('dbg.stack')} (${paused.frames.length})` }, { key: 'eval', label: t('dbg.eval') }]} />
      <div className="dbgbody">
        {tab === 'stack' && paused.frames.map((f, i) => (
          <div key={f.id} className={`frame ${i === paused.sel ? 'on' : ''}`} onClick={() => useStore.setState((st) => (st.paused ? { paused: { ...st.paused, sel: i } } : {}))}>
            <b>{f.fn}</b><span>{(f.orig?.file ?? f.url).split('/').slice(-2).join('/')}:{f.orig?.line ?? f.line}</span>
          </div>
        ))}
        {tab === 'scope' && frame && frame.scopes.map((sc: any, i: number) => <ScopeBlock key={`${frame.id}-${i}`} tabId={tabId} title={`${sc.type}${sc.name ? ` · ${sc.name}` : ''}`} objectId={sc.objectId} open={i === 0} />)}
        {tab === 'eval' && frame && <EvalBox tabId={tabId} frameId={frame.id} />}
      </div>
    </div>
  )
}

function ScopeBlock({ tabId, title, objectId, open: initial }: { tabId: string; title: string; objectId?: string; open?: boolean }) {
  const [open, setOpen] = useState(!!initial)
  const [vars, setVars] = useState<{ name: string; text: string; type: string; objectId?: string }[] | null>(null)
  useEffect(() => { if (open && objectId && !vars) void window.izlix.dbgScope(tabId, objectId).then((v: any) => setVars(v ?? [])) }, [open])
  return (
    <div className="scope">
      <div className="sh" onClick={() => setOpen(!open)}><i className={`arw-s ${open ? 'open' : ''}`} />{title}</div>
      {open && <div className="sv">{(vars ?? []).map((v) => <VarRow key={v.name} tabId={tabId} v={v} />)}{vars && !vars.length && <div className="dimtxt" style={{ padding: '2px 18px' }}>—</div>}</div>}
    </div>
  )
}

function VarRow({ tabId, v, depth = 0 }: { tabId: string; v: { name: string; text: string; type: string; objectId?: string }; depth?: number }) {
  const [open, setOpen] = useState(false)
  const [kids, setKids] = useState<{ name: string; text: string; type: string; objectId?: string }[] | null>(null)
  useEffect(() => { if (open && v.objectId && !kids && depth < 4) void window.izlix.dbgScope(tabId, v.objectId).then((k: any) => setKids(k ?? [])) }, [open])
  return (
    <div style={{ paddingLeft: depth * 12 }}>
      <div className="vr">{v.objectId ? <i className={`arw-s ${open ? 'open' : ''}`} onClick={() => setOpen(!open)} /> : <i className="arw-sp2" />}<span className="vn">{v.name}</span><span className="vt">{v.text}</span></div>
      {open && kids?.map((k) => <VarRow key={k.name} tabId={tabId} v={k} depth={depth + 1} />)}
    </div>
  )
}

function EvalBox({ tabId, frameId }: { tabId: string; frameId: string }) {
  const t = useT()
  const [expr, setExpr] = useState('')
  const [log, setLog] = useState<{ e: string; ok: boolean; r: string }[]>([])
  const run = async (): Promise<void> => { const e = expr.trim(); if (!e) return; setExpr(''); const r: any = await window.izlix.dbgEval(tabId, frameId, e); setLog((l) => [...l.slice(-30), { e, ok: !!r?.ok, r: String(r?.text ?? '') }]) }
  return (
    <div>
      {log.map((l, i) => <div key={i} className="repl-pair"><div className="repl-in"><b>›</b> {l.e}</div><div className={`repl-out ${l.ok ? '' : 'err'}`}>{l.r}</div></div>)}
      <input className="search" style={{ width: '100%', marginTop: 6 }} placeholder={t('dbg.evalHint')} value={expr} onChange={(e) => setExpr(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') void run() }} />
    </div>
  )
}
