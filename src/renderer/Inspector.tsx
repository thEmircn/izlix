import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { aggregateRenders, isMinifiedName, wastedRatio, type TrackerRow } from '../shared/tracker'
import { toast, useStore, useT } from './store'

interface Node { id: number; depth: number; name: string; t?: number; key?: string }
const ROW_H = 20

const Val = ({ v, depth = 0 }: { v: any; depth?: number }): React.ReactElement => {
  if (v && typeof v === 'object' && '$' in v) return <i style={{ color: '#9aa' }}>{v.$}</i>
  if (v === null) return <span style={{ color: '#a1a1aa' }}>null</span>
  if (typeof v === 'string') return <span style={{ color: '#d6b98a' }}>"{v}"</span>
  if (typeof v === 'number' || typeof v === 'boolean') return <span style={{ color: '#f78c6c' }}>{String(v)}</span>
  if (Array.isArray(v)) return v.length ? <div style={{ paddingLeft: depth ? 12 : 0 }}>{v.map((x, i) => <div key={i}>{i}: <Val v={x} depth={depth + 1} /></div>)}</div> : <span>[]</span>
  if (v && typeof v === 'object') {
    const ks = Object.keys(v)
    return ks.length ? <div style={{ paddingLeft: depth ? 12 : 0 }}>{ks.map((k) => <div key={k}><span style={{ color: '#e4e4e7' }}>{k}</span>: <Val v={v[k]} depth={depth + 1} /></div>)}</div> : <span>{'{}'}</span>
  }
  return <span>{String(v)}</span>
}

const latestRenderId = (events: Map<number, BusEvent>, tab: string | null): number => {
  let m = 0
  for (const e of events.values()) if (e.kind === 'render' && e.tabId === tab && e.id > m) m = e.id
  return m
}

/** React Inspector: bileşen ağacı (sanallaştırılmış, 2.000+ bileşende akıcı), props / state / hooks ve kaynak. */
export function Inspector({ height }: { height: number }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const events = useStore((s) => s.events)
  const editor = useStore((s) => s.editor)
  const [nodes, setNodes] = useState<Node[]>([])
  const [truncated, setTruncated] = useState(false)
  const [filter, setFilter] = useState('')
  const [sel, setSel] = useState<Node | null>(null)
  const [detail, setDetail] = useState<any>(null)
  const [scroll, setScroll] = useState(0)
  const [auto, setAuto] = useState(true)
  const [hideMin, setHideMin] = useState(true)
  const seen = useRef(-1)
  const render = latestRenderId(events, tabId)
  const counts = useMemo(() => new Map(aggregateRenders([...events.values()].filter((e) => e.tabId === tabId)).map((r) => [r.key, r])), [events, tabId])

  const [picking, setPicking] = useState(false)
  const nodesRef = useRef<Node[]>([]); nodesRef.current = nodes
  useEffect(() => {
    if (!tabId) return
    void window.izlix.dtEnable(tabId, 'elements')
    const off = window.izlix.onDt(async (e: any) => {
      if (e.id !== useStore.getState().activeTabId || e.method !== 'Overlay.inspectNodeRequested') return
      setPicking(false)
      void window.izlix.dt(tabId, 'Overlay.setInspectMode', { mode: 'none', highlightConfig: {} })
      await window.izlix.dt(tabId, 'DOM.getDocument', { depth: 0 })
      const r: any = await window.izlix.dt(tabId, 'DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [e.params.backendNodeId] })
      const nodeId = r?.nodeIds?.[0]
      const hit: any = nodeId ? await window.izlix.dtReactIndex(tabId, nodeId) : null
      if (!hit) { toast(t('insp.noComp')); return }
      const tree = await window.izlix.inspectTree(tabId)
      setNodes(tree?.nodes ?? [])
      const n = (tree?.nodes ?? []).find((x: Node) => x.id === hit.id)
      if (n) { setFilter(''); void pick(n) }
    })
    return () => { off(); void window.izlix.dt(tabId, 'Overlay.setInspectMode', { mode: 'none', highlightConfig: {} }).catch(() => {}); void window.izlix.dtDisable(tabId, 'elements') }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabId])
  const startPick = async (): Promise<void> => {
    if (!tabId) return
    const on = !picking; setPicking(on)
    await window.izlix.dt(tabId, 'Overlay.setInspectMode', { mode: on ? 'searchForNode' : 'none', highlightConfig: { contentColor: { r: 255, g: 255, b: 255, a: 0.12 }, borderColor: { r: 251, g: 191, b: 36, a: 0.5 }, showInfo: true } })
  }

  const refresh = useCallback(async () => {
    if (!tabId) return
    const r = await window.izlix.inspectTree(tabId)
    setNodes(r?.nodes ?? []); setTruncated(!!r?.truncated)
  }, [tabId])
  useEffect(() => { seen.current = -1; setSel(null); setDetail(null); void refresh() }, [tabId])
  useEffect(() => {
    if (!auto || render === seen.current) return
    const h = setTimeout(() => { seen.current = render; void refresh() }, 500) // commit firtinasinda 500 ms'de bir yenile
    return () => clearTimeout(h)
  }, [render, auto, refresh])

  const shown = useMemo(() => { const q = filter.trim().toLowerCase(); const base = hideMin ? nodes.filter((n) => !isMinifiedName(n.name)) : nodes; return q ? base.filter((n) => n.name.toLowerCase().includes(q)) : base }, [nodes, filter, hideMin])
  const viewH = Math.max(100, height * 0.5)
  const first = Math.max(0, Math.floor(scroll / ROW_H) - 5), last = Math.min(shown.length, Math.ceil((scroll + viewH) / ROW_H) + 5)

  const pick = async (n: Node): Promise<void> => {
    setSel(n); setDetail(null)
    if (tabId) setDetail(await window.izlix.inspectNode(tabId, n.id, n.t, n.name))
  }
  const editHook = async (index: number, json: string): Promise<void> => {
    if (!tabId || !sel) return
    try { JSON.parse(json) } catch { toast(t('insp.badJson')); return }
    const r = await window.izlix.setHook(tabId, sel.id, index, json)
    if (!r?.ok) toast(r?.err ?? t('insp.badJson'))
    setTimeout(() => void pick(sel), 350)
  }
  const editProp = async (key: string, json: string): Promise<void> => {
    if (!tabId || !sel) return
    try { JSON.parse(json) } catch { toast(t('insp.badJson')); return }
    const r = await window.izlix.setProp(tabId, sel.id, key, json)
    if (!r?.ok) toast(r?.err ?? t('insp.badJson'))
    setTimeout(() => void pick(sel), 350)
  }
  const open = (src: any): void => { void window.izlix.openSource({ file: src.file, line: src.line, column: src.column, editor }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div className="cmp-bar" style={{ padding: '8px 10px' }}>
        <button className={`btn ${picking ? 'primary' : ''}`} onClick={() => void startPick()}>{t('el.pick')}</button>
        <input placeholder={t('insp.search')} value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1, background: '#121214', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 8px' }} />
        <label><input type="checkbox" checked={hideMin} onChange={(e) => setHideMin(e.target.checked)} /> {t('insp.hideMin')}</label>
        <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> {t('insp.auto')}</label>
        <button className="btn" onClick={() => void refresh()}>{t('insp.refresh')}</button>
        <span style={{ color: 'var(--dim)' }}>{t('insp.count', { n: nodes.length })}{truncated ? '+' : ''}</span>
      </div>
      <div data-testid="tree" style={{ height: viewH, overflow: 'auto', borderTop: '1px solid var(--line)', font: '11px ui-monospace, Menlo, monospace' }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
        <div style={{ height: shown.length * ROW_H, position: 'relative' }}>
          {shown.slice(first, last).map((n, i) => {
            const row = counts.get(n.t != null ? `t${n.t}` : `n:${n.name}`)
            return (
              <div key={n.id} onClick={() => void pick(n)} style={{ position: 'absolute', top: (first + i) * ROW_H, height: ROW_H, left: 0, right: 0, paddingLeft: 8 + (filter ? 0 : Math.min(n.depth, 40) * 10), whiteSpace: 'nowrap', cursor: 'default', background: sel?.id === n.id ? 'rgba(255,255,255,.1)' : undefined, lineHeight: `${ROW_H}px` }}>
                <span style={{ color: '#e4e4e7' }}>{n.name}</span>{n.key != null && <span style={{ color: '#d6b98a' }}> key="{n.key}"</span>}
                {row && <span style={{ color: row.renders > 5 ? '#ffb454' : 'var(--dim)' }}> ×{row.renders}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--line)', padding: 8, font: '11px ui-monospace, Menlo, monospace' }}>
        {!sel && <div style={{ color: 'var(--dim)' }}>{t('insp.pick')}</div>}
        {sel && !detail && <div style={{ color: 'var(--dim)' }}>{t('insp.loading')}</div>}
        {sel && detail && (
          <>
            <div><b>{detail.name}</b>{detail.ms != null && <span style={{ color: 'var(--dim)' }}> · {t('insp.lastRender', { ms: detail.ms })}</span>}</div>
            {detail.source && <div>{t('tl.source')}: <a href="#" style={{ color: 'var(--fg)', textDecoration: 'underline', textUnderlineOffset: 2 }} onClick={(e) => { e.preventDefault(); open(detail.source) }}>{String(detail.source.file).split('/').slice(-2).join('/')}:{detail.source.line}</a></div>}
            <div style={{ marginTop: 6, color: 'var(--dim)' }}>props</div>
            {Object.keys(detail.propsRaw ?? {}).length > 0
              ? <div>{Object.entries(detail.propsRaw as Record<string, string>).map(([k, raw]) => (
                  <div key={k} className="hookrow"><span style={{ color: '#e4e4e7' }}>{k}</span>: <input className="hookinp" defaultValue={raw} spellCheck={false} title={t('insp.editHook')}
                    onKeyDown={(e) => { if (e.key === 'Enter') void editProp(k, (e.target as HTMLInputElement).value) }} onBlur={(e) => { if (e.target.value !== raw) void editProp(k, e.target.value) }} /></div>
                ))}</div>
              : <Val v={detail.props} />}
            {detail.state !== undefined && <><div style={{ marginTop: 6, color: 'var(--dim)' }}>state</div><Val v={detail.state} /></>}
            {detail.hooks?.length > 0 && <><div style={{ marginTop: 6, color: 'var(--dim)' }}>hooks</div>
              {detail.hooks.map((h: any) => (
                <div key={h.index} className="hookrow">#{h.index} <span style={{ color: '#a1a1aa' }}>{h.kind}</span>{' '}
                  {h.kind === 'state' && h.raw != null
                    ? <input className="hookinp" defaultValue={h.raw} spellCheck={false} title={t('insp.editHook')}
                        onKeyDown={(e) => { if (e.key === 'Enter') void editHook(h.index, (e.target as HTMLInputElement).value) }}
                        onBlur={(e) => { if (e.target.value !== h.raw) void editHook(h.index, e.target.value) }} />
                    : <Val v={h.value} depth={1} />}
                </div>
              ))}</>}
          </>
        )}
      </div>
    </div>
  )
}

/** Render Tracker: bileşen başına render sayısı, süresi ve nedeni (seçili zaman aralığında). */
export function RenderTracker({ events, range }: { events: BusEvent[]; range: [number, number] | null }) {
  const t = useT()
  const editor = useStore((s) => s.editor)
  const rows = useMemo(() => aggregateRenders(events, range ?? undefined), [events, range])
  const open = (r: TrackerRow): void => { if (r.file && r.line) void window.izlix.openSource({ file: r.file, line: r.line, column: r.column, editor }) }
  const totalRenders = rows.reduce((a, r) => a + r.renders, 0), totalMs = rows.reduce((a, r) => a + r.totalMs, 0)
  const wasted = rows.reduce((a, r) => a + (r.reasons.parent ?? 0), 0)
  const maxMs = Math.max(0.1, ...rows.map((r) => r.totalMs))
  const REASON_CLS: Record<string, string> = { mount: 'ok', state: 'ac', props: 'ac', context: 'ac', parent: 'warn', hooks: 'ac' }
  return (
    <div className="trk" style={{ overflow: 'auto', flex: 1 }}>
      {rows.length > 0 && (
        <div className="net-stats">
          <div className="stat"><span>{t('trk.component')}</span><b>{rows.length}</b></div>
          <div className="stat"><span>{t('trk.renders')}</span><b>{totalRenders}</b></div>
          <div className="stat"><span>{t('trk.total')}</span><b>{totalMs.toFixed(1)} ms</b></div>
          <div className="stat"><span>{t('trk.wasted')}</span><b className={totalRenders && wasted / totalRenders > 0.4 ? 'bad' : ''}>{totalRenders ? Math.round((wasted / totalRenders) * 100) : 0}%</b></div>
        </div>
      )}
      <table className="tbl trk-tbl">
        <thead><tr>
          <th>{t('trk.component')}</th><th className="num">{t('trk.renders')}</th><th>{t('trk.total')}</th><th>{t('trk.reason')}</th><th className="num">{t('trk.wasted')}</th>
        </tr></thead>
        <tbody>
          {rows.slice(0, 300).map((r) => (
            <tr key={r.key} title={[...r.changedProps.map((p) => `props.${p}`), ...r.changedHooks.map((h) => `hook[${h}]`)].join(', ')}>
              <td><div className="trk-name">{r.name}</div>
                {r.file ? <a href="#" className="trk-src" onClick={(e) => { e.preventDefault(); open(r) }}>{r.file.split('/').slice(-2).join('/')}:{r.line}</a> : null}</td>
              <td className="num"><span className="trk-n">{r.renders}×</span></td>
              <td><div className="trk-bar"><b style={{ width: `${Math.max(3, (r.totalMs / maxMs) * 100)}%` }} /></div><small>{r.totalMs.toFixed(1)} ms · max {r.maxMs.toFixed(1)}</small></td>
              <td><div className="trk-chips">{Object.entries(r.reasons).map(([k, v]) => <span key={k} className={`rchip ${REASON_CLS[k] ?? ''}`}>{k}{v > 1 ? ` ×${v}` : ''}</span>)}</div>
                {(r.changedProps.length > 0 || r.changedHooks.length > 0) && <small>{[...r.changedProps.map((p) => `props.${p}`), ...r.changedHooks.map((h) => `hook[${h}]`)].join(', ')}</small>}</td>
              <td className="num" style={{ color: wastedRatio(r) > 0.5 && r.renders > 2 ? 'var(--warn)' : 'var(--dim)' }}>{r.renders > 1 ? `${Math.round(wastedRatio(r) * 100)}%` : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div className="empty-hint">{t('trk.empty')}</div>}
    </div>
  )
}
