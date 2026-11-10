import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { attrMap, autoCollapsed, findByKey, findNode, flatten, keyOf, nodeLabel, pathTo, selectorOf, type DomNode, type DomRow } from '../shared/dom'
import { toast, useStore, useT, tNow } from './store'
import { Seg } from './ui'

const ROW = 21
const HL = { contentColor: { r: 255, g: 255, b: 255, a: 0.12 }, paddingColor: { r: 251, g: 191, b: 36, a: 0.18 }, borderColor: { r: 251, g: 191, b: 36, a: 0.4 }, marginColor: { r: 255, g: 255, b: 255, a: 0.06 }, showInfo: true, showStyles: false }
type DTab = 'styles' | 'computed' | 'layout' | 'attrs' | 'react'

/** Elements paneli: DOM agaci (sanallastirilmis), sayfada vurgulama, oge secici, stil/kutu modeli/oznitelik duzenleme, React bileseni. */
export function Elements() {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const editor = useStore((s) => s.editor)
  const [root, setRoot] = useState<DomNode | null>(null)
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const [sel, setSel] = useState<number | null>(null)
  const [picking, setPicking] = useState(false)
  const [q, setQ] = useState('')
  const [scroll, setScroll] = useState(0)
  const [tab, setTab] = useState<DTab>('styles')
  const listRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<number | null>(null); selRef.current = sel
  const dt = useCallback((method: string, params?: Record<string, unknown>) => (tabId ? window.izlix.dt(tabId, method, params).catch(() => null) : Promise.resolve(null)) as Promise<any>, [tabId])

  const load = useCallback(async (initial = false) => {
    const r = await dt('DOM.getDocument', { depth: -1, pierce: true })
    if (!r?.root) return
    setRoot(r.root)
    if (initial) setCollapsed(autoCollapsed(r.root))
  }, [dt])

  // panel acilinca DOM/CSS/Overlay etkinlesir, kapaninca kapanir (sayfayi bozma)
  useEffect(() => {
    if (!tabId) return
    let live = true
    void window.izlix.dtEnable(tabId, 'elements').then(() => { if (live) { setSel(null); void load(true) } })
    return () => { live = false; void window.izlix.dt(tabId, 'Overlay.hideHighlight').catch(() => {}); void window.izlix.dtDisable(tabId, 'elements') }
  }, [tabId, load])

  // DOM degisimleri: gecikmeli yeniden yukleme; oge secici sonucu
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null
    return window.izlix.onDt(async (e: any) => {
      if (e.id !== useStore.getState().activeTabId) return
      if (e.method === 'Overlay.inspectNodeRequested') {
        setPicking(false)
        const r = await dt('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [e.params.backendNodeId] })
        const nodeId = r?.nodeIds?.[0]
        if (nodeId) { await load(); const rr = rootRef.current; const nn = rr ? findNode(rr, nodeId) : null; if (nn) { reveal(nodeId); setSel(keyOf(nn)) } }
      } else if (e.method.startsWith('DOM.')) {
        if (timer) clearTimeout(timer)
        timer = setTimeout(() => void load(), 350)
      }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dt, load])

  const rootRef = useRef<DomNode | null>(null); rootRef.current = root
  const reveal = (nodeId: number): void => {
    const r = rootRef.current; if (!r) return
    const path = pathTo(r, nodeId)
    if (path) setCollapsed((c) => { const n = new Set(c); for (const p of [...path, nodeId]) { const nd = findNode(r, p); if (nd) n.delete(keyOf(nd)) } return n })
  }

  const rows = useMemo(() => (root ? flatten(root, collapsed) : []), [root, collapsed])
  const matches = useMemo(() => {
    const n = q.trim().toLowerCase(); if (!n) return null
    const set = new Set<number>()
    for (const r of rows) { const a = attrMap(r.node); if (!r.close && (nodeLabel(r.node).toLowerCase().includes(n) || (a.id ?? '').toLowerCase().includes(n) || (a.class ?? '').toLowerCase().includes(n))) set.add(r.node.nodeId) }
    return set
  }, [q, rows])

  // secili satiri gorunur yap
  useEffect(() => {
    if (sel == null || !listRef.current) return
    const i = rows.findIndex((r) => keyOf(r.node) === sel && !r.close)
    if (i < 0) return
    const top = i * ROW, el = listRef.current
    if (top < el.scrollTop || top > el.scrollTop + el.clientHeight - ROW * 2) el.scrollTo({ top: Math.max(0, top - el.clientHeight / 3), behavior: 'smooth' })
  }, [sel, rows.length])

  const first = Math.max(0, Math.floor(scroll / ROW) - 8), last = Math.min(rows.length, Math.ceil((scroll + 900) / ROW) + 8)
  const toggle = (key: number): void => setCollapsed((c) => { const n = new Set(c); n.has(key) ? n.delete(key) : n.add(key); return n })
  const startPick = async (): Promise<void> => { const on = !picking; setPicking(on); await dt('Overlay.setInspectMode', { mode: on ? 'searchForNode' : 'none', highlightConfig: HL }) }
  const highlight = (id: number | null): void => { void dt(id == null ? 'Overlay.hideHighlight' : 'Overlay.highlightNode', id == null ? undefined : { nodeId: id, highlightConfig: HL }) }
  const selNode = root && sel != null ? findByKey(root, sel) : null

  return (
    <div className="el">
      <div className="net-bar">
        <button className={`btn ${picking ? 'primary' : ''}`} onClick={() => void startPick()} title={t('el.pickHint')}>{t('el.pick')}</button>
        <input className="search" placeholder={t('el.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => void load()}>{t('insp.refresh')}</button>
      </div>
      <div className="el-tree" ref={listRef} onScroll={(e) => setScroll(e.currentTarget.scrollTop)} onMouseLeave={() => highlight(null)}>
        <div style={{ height: rows.length * ROW, position: 'relative' }}>
          {rows.slice(first, last).map((r, i) => (
            <TreeRow key={`${keyOf(r.node)}-${r.close ? 'c' : 'o'}`} r={r} top={(first + i) * ROW} selected={sel === keyOf(r.node) && !r.close} match={!!matches?.has(r.node.nodeId)} dim={!!matches && !matches.has(r.node.nodeId)}
              onToggle={() => toggle(keyOf(r.node))} onSelect={() => { if (!r.close) setSel(keyOf(r.node)) }} onHover={(on) => highlight(on && !r.close ? r.node.nodeId : null)} />
          ))}
        </div>
        {!root && <div className="empty-hint">{t('el.loading')}</div>}
      </div>
      <div className="el-detail">
        {selNode && selNode.nodeType === 1 ? (
          <>
            <div className="el-crumb" title={root ? selectorOf(root, selNode.nodeId) : ''}>{root ? selectorOf(root, selNode.nodeId) : ''}</div>
            <Seg<DTab> small value={tab} onChange={setTab} items={(['styles', 'computed', 'layout', 'attrs', 'react'] as DTab[]).map((k) => ({ key: k, label: t(`el.tab.${k}` as any) }))} />
            <div className="el-pane" key={`${tab}-${selNode.nodeId}`}>
              {tab === 'styles' && <Styles nodeId={selNode.nodeId} dt={dt} node={selNode} />}
              {tab === 'computed' && <Computed nodeId={selNode.nodeId} dt={dt} />}
              {tab === 'layout' && <Layout nodeId={selNode.nodeId} dt={dt} />}
              {tab === 'attrs' && <Attrs node={selNode} dt={dt} root={root!} reload={() => load()} onDeleted={() => setSel(null)} />}
              {tab === 'react' && <ReactInfo nodeId={selNode.nodeId} tabId={tabId!} editor={editor} />}
            </div>
          </>
        ) : <div className="empty-hint">{t('el.select')}</div>}
      </div>
    </div>
  )
}

function TreeRow({ r, top, selected, match, dim, onToggle, onSelect, onHover }: { r: DomRow; top: number; selected: boolean; match: boolean; dim: boolean; onToggle(): void; onSelect(): void; onHover(on: boolean): void }) {
  const n = r.node, a = attrMap(n)
  const indent = 10 + r.depth * 14
  let body: React.ReactNode
  if (r.close) body = <span className="tg">&lt;/{(n.localName ?? n.nodeName).toLowerCase()}&gt;</span>
  else if (n.nodeType === 1) {
    const tag = (n.localName ?? n.nodeName).toLowerCase()
    const keys = Object.keys(a)
    body = <><span className="tg">&lt;{tag}</span>{keys.slice(0, 6).map((k) => <span key={k}> <span className="an">{k}</span>{a[k] !== '' && <>=<span className="av">"{a[k].length > 48 ? a[k].slice(0, 48) + '…' : a[k]}"</span></>}</span>)}{keys.length > 6 && <span className="av"> …</span>}<span className="tg">&gt;</span>{r.hasChildren && !r.open && <span className="ell">…</span>}</>
  } else if (n.nodeType === 3) body = <span className="tx">{nodeLabel(n)}</span>
  else body = <span className="cm">{nodeLabel(n)}</span>
  return (
    <div className={`el-row ${selected ? 'sel' : ''} ${match ? 'match' : ''} ${dim ? 'dim' : ''}`} style={{ top, paddingLeft: indent }} onClick={onSelect} onMouseEnter={() => onHover(true)}>
      {r.hasChildren && !r.close ? <button className={`arw ${r.open ? 'open' : ''}`} onClick={(e) => { e.stopPropagation(); onToggle() }} aria-label={tNow('el.toggle')} /> : <span className="arw-sp" />}
      <span className="el-lbl">{body}</span>
    </div>
  )
}

type Dt = (m: string, p?: Record<string, unknown>) => Promise<any>

function Styles({ nodeId, dt, node }: { nodeId: number; dt: Dt; node: DomNode }) {
  const t = useT()
  const [data, setData] = useState<any>(null)
  const [inline, setInline] = useState(attrMap(node).style ?? '')
  const [rev, setRev] = useState(0)
  useEffect(() => { let live = true; setData(null); void dt('CSS.getMatchedStylesForNode', { nodeId }).then((d) => { if (live) setData(d) }); setInline(attrMap(node).style ?? ''); return () => { live = false } }, [nodeId, rev, node])
  const apply = async (): Promise<void> => { await dt('DOM.setAttributeValue', { nodeId, name: 'style', value: inline }); setRev((r) => r + 1) }
  const rules: any[] = (data?.matchedCSSRules ?? []).slice().reverse()
  return (
    <div className="styles">
      <section className="rule">
        <h5>element.style <small>{t('el.editable')}</small></h5>
        <textarea rows={Math.max(2, inline.split(';').length)} spellCheck={false} value={inline} placeholder="color: red; margin: 0" onChange={(e) => setInline(e.target.value)} onBlur={() => void apply()} onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) void apply() }} />
      </section>
      {!data && <div className="skeleton" style={{ height: 40, margin: '8px 0' }} />}
      {rules.map((r, i) => (
        <section className="rule" key={i}>
          <h5>{r.rule.selectorList?.text}<small>{r.rule.origin === 'user-agent' ? 'user agent' : (r.rule.styleSheetId ? 'stylesheet' : r.rule.origin)}</small></h5>
          {(r.rule.style?.cssProperties ?? []).filter((p: any) => p.name && p.value !== undefined && !p.implicit).map((p: any) => <div key={p.name} className={`prop ${p.disabled ? 'off' : ''}`}><span>{p.name}</span><code>{p.value}{p.important ? ' !important' : ''}</code></div>)}
        </section>
      ))}
      {data && !rules.length && <div className="empty-hint">{t('el.noRules')}</div>}
    </div>
  )
}

function Computed({ nodeId, dt }: { nodeId: number; dt: Dt }) {
  const t = useT()
  const [list, setList] = useState<{ name: string; value: string }[] | null>(null)
  const [q, setQ] = useState('')
  useEffect(() => { let live = true; setList(null); void dt('CSS.getComputedStyleForNode', { nodeId }).then((d) => { if (live) setList(d?.computedStyle ?? []) }); return () => { live = false } }, [nodeId])
  const shown = (list ?? []).filter((p) => !q || p.name.includes(q.toLowerCase()))
  return (
    <div>
      <input className="search" style={{ width: '100%', marginBottom: 6 }} placeholder={t('el.filterProps')} value={q} onChange={(e) => setQ(e.target.value)} />
      {!list && <div className="skeleton" style={{ height: 60 }} />}
      {shown.map((p) => <div key={p.name} className="prop"><span>{p.name}</span><code>{p.value}</code></div>)}
    </div>
  )
}

function Layout({ nodeId, dt }: { nodeId: number; dt: Dt }) {
  const t = useT()
  const [m, setM] = useState<any>(undefined)
  useEffect(() => { let live = true; setM(undefined); void dt('DOM.getBoxModel', { nodeId }).then((d) => { if (live) setM(d?.model ?? null) }); return () => { live = false } }, [nodeId])
  if (m === undefined) return <div className="skeleton" style={{ height: 120 }} />
  if (!m) return <div className="empty-hint">{t('el.noBox')}</div>
  const q = (a: number[]) => ({ x1: a[0], y1: a[1], x2: a[2], y2: a[5] })
  const c = q(m.content), p = q(m.padding), b = q(m.border), g = q(m.margin)
  const r = (v: number): number => Math.round(v * 10) / 10
  const sides = (outer: ReturnType<typeof q>, inner: ReturnType<typeof q>) => ({ top: r(inner.y1 - outer.y1), right: r(outer.x2 - inner.x2), bottom: r(outer.y2 - inner.y2), left: r(inner.x1 - outer.x1) })
  const mg = sides(g, b), bd = sides(b, p), pd = sides(p, c)
  const Side = ({ s }: { s: ReturnType<typeof sides> }) => <><i className="sd t">{s.top}</i><i className="sd r">{s.right}</i><i className="sd b">{s.bottom}</i><i className="sd l">{s.left}</i></>
  return (
    <div className="boxm">
      <div className="bx margin"><label>margin</label><Side s={mg} />
        <div className="bx border"><label>border</label><Side s={bd} />
          <div className="bx padding"><label>padding</label><Side s={pd} />
            <div className="bx content">{r(m.width)} × {r(m.height)}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Attrs({ node, dt, root, reload, onDeleted }: { node: DomNode; dt: Dt; root: DomNode; reload(): void; onDeleted(): void }) {
  const t = useT()
  const a = attrMap(node)
  const [name, setName] = useState(''); const [value, setValue] = useState('')
  const set = async (k: string, v: string): Promise<void> => { await dt('DOM.setAttributeValue', { nodeId: node.nodeId, name: k, value: v }); reload() }
  return (
    <div className="attrs">
      {Object.entries(a).map(([k, v]) => (
        <div key={k} className="arow">
          <span>{k}</span>
          <input defaultValue={v} spellCheck={false} onBlur={(e) => { if (e.target.value !== v) void set(k, e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter') { const nv = (e.target as HTMLInputElement).value; if (nv !== v) void set(k, nv) } }} />
          <button className="icon-btn" aria-label="remove" onClick={() => void dt('DOM.removeAttribute', { nodeId: node.nodeId, name: k }).then(reload)}>×</button>
        </div>
      ))}
      <div className="arow add"><input placeholder={t('el.attrName')} value={name} onChange={(e) => setName(e.target.value)} /><input placeholder={t('el.attrValue')} value={value} onChange={(e) => setValue(e.target.value)} />
        <button className="btn" disabled={!name.trim()} onClick={() => { void set(name.trim(), value); setName(''); setValue('') }}>+</button></div>
      <div className="actions">
        <button className="btn" onClick={() => { void navigator.clipboard?.writeText(selectorOf(root, node.nodeId)); toast(t('toast.copied')) }}>{t('el.copySel')}</button>
        <button className="btn" onClick={() => void dt('DOM.getOuterHTML', { nodeId: node.nodeId }).then((d) => { if (d?.outerHTML) { void navigator.clipboard?.writeText(d.outerHTML); toast(t('toast.copied')) } })}>{t('el.copyHtml')}</button>
        <button className="btn" onClick={() => void window.izlix.screenshot(useStore.getState().activeTabId!, 'node', { nodeId: node.nodeId }).then((r: any) => toast(!r ? t('toast.shotFail') : t('toast.shot', { p: String(r.path).split('/').pop() ?? '' })))}>{t('el.shot')}</button>
        <button className="btn danger" onClick={() => void dt('DOM.removeNode', { nodeId: node.nodeId }).then(() => { onDeleted(); reload() })}>{t('el.delete')}</button>
      </div>
    </div>
  )
}

function ReactInfo({ nodeId, tabId, editor }: { nodeId: number; tabId: string; editor: string }) {
  const t = useT()
  const [chain, setChain] = useState<{ name: string; file?: string; line?: number }[] | null | undefined>(undefined)
  useEffect(() => { let live = true; setChain(undefined); void window.izlix.dtReact(tabId, nodeId).then((c: any) => { if (live) setChain(c) }); return () => { live = false } }, [nodeId, tabId])
  if (chain === undefined) return <div className="skeleton" style={{ height: 50 }} />
  if (!chain?.length) return <div className="empty-hint">{t('el.noReact')}</div>
  return (
    <div className="rchain">{chain.map((c, i) => (
      <div key={i} className="rc" style={{ paddingLeft: i * 10 }}>
        <b>{c.name}</b>
        {c.file && c.line && <a href="#" onClick={(e) => { e.preventDefault(); void window.izlix.openSource({ file: c.file!, line: c.line!, editor }) }}>{c.file.split('/').slice(-2).join('/')}:{c.line}</a>}
      </div>
    ))}</div>
  )
}
