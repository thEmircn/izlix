import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { highlightLine, initState, langOf, type HlState } from '../shared/highlight'
import { buildNetworkRows } from '../shared/network'
import { useStore, useT } from './store'

interface OrigSource { name: string; content: string | null }
interface Bundle { url: string; code: string; mapUrl?: string; sources: OrigSource[]; truncated: boolean }
interface FileView { name: string; text: string | null; path?: string }
const ROW = 18

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
    const o = orig ? b.sources.find((s) => s.name === orig || s.name.endsWith(orig)) : null
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
        {file && <CodeView key={file.name} file={file} jump={jump} editor={editor} truncated={!!(b && b !== 'loading' && b.truncated && file.text === b.code)} />}
      </div>
    </div>
  )
}

function CodeView({ file, jump, editor, truncated }: { file: FileView; jump: number | null; editor: string; truncated: boolean }) {
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
              <div key={i} className={`cl ${jump === i + 1 ? 'jump' : ''} ${isHit ? 'hit' : ''}`} style={{ top: i * ROW }}>
                <span className="ln">{i + 1}</span>
                <span className="lc">{toks.map((tk, j) => <span key={j} className={`tk-${tk.t}`}>{tk.s}</span>)}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
