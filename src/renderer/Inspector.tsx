import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { aggregateRenders, wastedRatio, type TrackerRow } from '../shared/tracker'
import { useStore } from './store'

interface Node { id: number; depth: number; name: string; t?: number; key?: string }
const ROW_H = 20

const Val = ({ v, depth = 0 }: { v: any; depth?: number }): React.ReactElement => {
  if (v && typeof v === 'object' && '$' in v) return <i style={{ color: '#9aa' }}>{v.$}</i>
  if (v === null) return <span style={{ color: '#c792ea' }}>null</span>
  if (typeof v === 'string') return <span style={{ color: '#ecc48d' }}>"{v}"</span>
  if (typeof v === 'number' || typeof v === 'boolean') return <span style={{ color: '#f78c6c' }}>{String(v)}</span>
  if (Array.isArray(v)) return v.length ? <div style={{ paddingLeft: depth ? 12 : 0 }}>{v.map((x, i) => <div key={i}>{i}: <Val v={x} depth={depth + 1} /></div>)}</div> : <span>[]</span>
  if (v && typeof v === 'object') {
    const ks = Object.keys(v)
    return ks.length ? <div style={{ paddingLeft: depth ? 12 : 0 }}>{ks.map((k) => <div key={k}><span style={{ color: '#82aaff' }}>{k}</span>: <Val v={v[k]} depth={depth + 1} /></div>)}</div> : <span>{'{}'}</span>
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
  const seen = useRef(-1)
  const render = latestRenderId(events, tabId)
  const counts = useMemo(() => new Map(aggregateRenders([...events.values()].filter((e) => e.tabId === tabId)).map((r) => [r.key, r])), [events, tabId])

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

  const shown = useMemo(() => { const q = filter.trim().toLowerCase(); return q ? nodes.filter((n) => n.name.toLowerCase().includes(q)) : nodes }, [nodes, filter])
  const viewH = Math.max(100, height * 0.5)
  const first = Math.max(0, Math.floor(scroll / ROW_H) - 5), last = Math.min(shown.length, Math.ceil((scroll + viewH) / ROW_H) + 5)

  const pick = async (n: Node): Promise<void> => {
    setSel(n); setDetail(null)
    if (tabId) setDetail(await window.izlix.inspectNode(tabId, n.id, n.t, n.name))
  }
  const open = (src: any): void => { void window.izlix.openSource({ file: src.file, line: src.line, column: src.column, editor }) }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ display: 'flex', gap: 8, padding: '4px 8px', alignItems: 'center' }}>
        <input placeholder="Bileşen ara…" value={filter} onChange={(e) => setFilter(e.target.value)} style={{ flex: 1, background: '#121214', border: '1px solid var(--line)', borderRadius: 5, padding: '2px 8px' }} />
        <label><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> otomatik</label>
        <button className="btn" onClick={() => void refresh()}>Yenile</button>
        <span style={{ color: 'var(--dim)' }}>{nodes.length} bileşen{truncated ? '+' : ''}</span>
      </div>
      <div data-testid="tree" style={{ height: viewH, overflow: 'auto', borderTop: '1px solid var(--line)', font: '11px ui-monospace, Menlo, monospace' }} onScroll={(e) => setScroll(e.currentTarget.scrollTop)}>
        <div style={{ height: shown.length * ROW_H, position: 'relative' }}>
          {shown.slice(first, last).map((n, i) => {
            const row = counts.get(n.t != null ? `t${n.t}` : `n:${n.name}`)
            return (
              <div key={n.id} onClick={() => void pick(n)} style={{ position: 'absolute', top: (first + i) * ROW_H, height: ROW_H, left: 0, right: 0, paddingLeft: 8 + (filter ? 0 : Math.min(n.depth, 40) * 10), whiteSpace: 'nowrap', cursor: 'default', background: sel?.id === n.id ? '#3a4a66' : undefined, lineHeight: `${ROW_H}px` }}>
                <span style={{ color: '#82aaff' }}>{n.name}</span>{n.key != null && <span style={{ color: '#ecc48d' }}> key="{n.key}"</span>}
                {row && <span style={{ color: row.renders > 5 ? '#ffb454' : 'var(--dim)' }}> ×{row.renders}</span>}
              </div>
            )
          })}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', borderTop: '1px solid var(--line)', padding: 8, font: '11px ui-monospace, Menlo, monospace' }}>
        {!sel && <div style={{ color: 'var(--dim)' }}>Bir bileşen seç: props, state, hooks ve kaynak burada.</div>}
        {sel && !detail && <div style={{ color: 'var(--dim)' }}>yükleniyor…</div>}
        {sel && detail && (
          <>
            <div><b>{detail.name}</b>{detail.ms != null && <span style={{ color: 'var(--dim)' }}> · son render {detail.ms} ms</span>}</div>
            {detail.source && <div>kaynak: <a href="#" style={{ color: '#4ea1ff' }} onClick={(e) => { e.preventDefault(); open(detail.source) }}>{String(detail.source.file).split('/').slice(-2).join('/')}:{detail.source.line}</a></div>}
            <div style={{ marginTop: 6, color: 'var(--dim)' }}>props</div><Val v={detail.props} />
            {detail.state !== undefined && <><div style={{ marginTop: 6, color: 'var(--dim)' }}>state</div><Val v={detail.state} /></>}
            {detail.hooks?.length > 0 && <><div style={{ marginTop: 6, color: 'var(--dim)' }}>hooks</div>
              {detail.hooks.map((h: any) => <div key={h.index}>#{h.index} <span style={{ color: '#c792ea' }}>{h.kind}</span> <Val v={h.value} depth={1} /></div>)}</>}
          </>
        )}
      </div>
    </div>
  )
}

/** Render Tracker: bileşen başına render sayısı, süresi ve nedeni (seçili zaman aralığında). */
export function RenderTracker({ events, range }: { events: BusEvent[]; range: [number, number] | null }) {
  const editor = useStore((s) => s.editor)
  const rows = useMemo(() => aggregateRenders(events, range ?? undefined), [events, range])
  const open = (r: TrackerRow): void => { if (r.file && r.line) void window.izlix.openSource({ file: r.file, line: r.line, column: r.column, editor }) }
  return (
    <div style={{ overflow: 'auto', flex: 1 }}>
      <table style={{ borderCollapse: 'collapse', width: '100%', font: '11px ui-monospace, Menlo, monospace' }}>
        <thead><tr style={{ textAlign: 'left', color: 'var(--dim)', position: 'sticky', top: 0, background: 'var(--bg)' }}>
          <th style={{ padding: '3px 8px' }}>bileşen</th><th>render</th><th>toplam ms</th><th>maks ms</th><th>neden</th><th>değişen</th><th>gereksiz?</th><th>kaynak</th></tr></thead>
        <tbody>
          {rows.slice(0, 300).map((r) => (
            <tr key={r.key}>
              <td style={{ padding: '2px 8px', color: '#82aaff' }}>{r.name}</td><td>{r.renders}</td><td>{r.totalMs.toFixed(1)}</td><td>{r.maxMs.toFixed(1)}</td>
              <td>{Object.entries(r.reasons).map(([k, v]) => `${k}×${v}`).join(' ')}</td>
              <td>{[...r.changedProps.map((p) => `props.${p}`), ...r.changedHooks.map((h) => `hook[${h}]`)].join(', ')}</td>
              <td style={{ color: wastedRatio(r) > 0.5 && r.renders > 2 ? '#ffb454' : 'var(--dim)' }}>{r.renders > 1 ? `${Math.round(wastedRatio(r) * 100)}%` : ''}</td>
              <td>{r.file ? <a href="#" style={{ color: '#4ea1ff' }} onClick={(e) => { e.preventDefault(); open(r) }}>{r.file.split('/').slice(-2).join('/')}:{r.line}</a> : ''}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!rows.length && <div style={{ padding: 8, color: 'var(--dim)' }}>Henüz render kaydı yok. Sayfayla etkileş.</div>}
    </div>
  )
}
