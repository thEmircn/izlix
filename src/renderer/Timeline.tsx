import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent as Ev } from '../shared/events'
import { useStore, writePref, useT } from './store'
import { Inspector, RenderTracker } from './Inspector'
import { causeChain, effectsOf } from '../shared/chain'
import { ruleFromRequest } from '../shared/rules'

// ---- sabitler ----
const LANES = ['input', 'request', 'response', 'render', 'console', 'error'] as const
type Lane = (typeof LANES)[number]
const COLOR: Record<Lane, string> = { input: '#c792ea', request: '#4ea1ff', response: '#3ecf8e', render: '#ffb454', console: '#8fa3b8', error: '#ff5c5c' }
const LANE_H = 30, PAD_L = 62, PAD_R = 14, AXIS_H = 20, DEFAULT_WINDOW = 15_000
const NET_TYPES = ['Fetch', 'XHR', 'Document']

function laneOf(e: Ev, allReq: boolean): Lane | null {
  switch (e.kind) {
    case 'input': return 'input'
    case 'request': return allReq || NET_TYPES.includes(e.payload.type) ? 'request' : null
    case 'response': return allReq || NET_TYPES.includes(e.payload.type) ? 'response' : null
    case 'render': return e.payload.count > 0 ? 'render' : null
    case 'error': return 'error'
    case 'console': return 'console'
    default: return null
  }
}

function label(e: Ev): string {
  const p = e.payload
  switch (e.kind) {
    case 'input': return `${p.name} ${p.target}`
    case 'request': return `${p.modified ? '⚡ ' : ''}${p.method} ${shortUrl(p.url)}`
    case 'response': return `${p.status} ${shortUrl(p.url)}`
    case 'render': return `commit · ${p.count} render`
    case 'error': return String(p.text ?? p.errorText ?? 'error').split('\n')[0]
    case 'console': return String(p.text ?? '')
    default: return e.source
  }
}
const shortUrl = (u: string): string => { try { const x = new URL(u); return x.pathname + x.search } catch { return u } }
const fmtT = (ms: number): string => (ms / 1000).toFixed(2) + 's'

/** Unified Developer Timeline v0: 6 serit, kesin (duz) / tahmini (kesikli) oklar, filtre, aralik secimi. */
export function Timeline({ width, height }: { width: number; height: number }) {
  const t = useT()
  const events = useStore((s) => s.events)
  const activeTabId = useStore((s) => s.activeTabId)
  const selected = useStore((s) => s.selectedEventId)
  const editor = useStore((s) => s.editor)
  const set = useStore((s) => s.set)
  const [tab, setTab] = useState<'timeline' | 'raw' | 'components' | 'renders'>('timeline')
  const [hidden, setHidden] = useState<Set<Lane>>(new Set())
  const [allReq, setAllReq] = useState(false)
  const [range, setRange] = useState<[number, number] | null>(null)

  // kuzey yildizi metrigi (plan bolum 10): Timeline'in acildigi Workspace; sekme basina bir kez, yalnizca sayilar
  const sent = useRef(new Set<string>())
  const wsId = useStore((s) => s.activeWorkspaceId)
  const all = useMemo(() => [...events.values()].filter((e) => e.tabId === activeTabId).sort((a, b) => a.ts - b.ts), [events, activeTabId])
  useEffect(() => {
    if (!activeTabId || tab !== 'timeline' || !all.length) return
    if (!sent.current.has('open:' + wsId)) { sent.current.add('open:' + wsId); void window.izlix.track('timeline.open', { events: all.length }) }
    if (!sent.current.has('chain') && all.some((e) => e.links.some((l) => l.certainty === 'exact'))) { sent.current.add('chain'); void window.izlix.track('chain.seen') }
  }, [all, tab, activeTabId, wsId])
  const tMax = all.length ? all[all.length - 1].ts : Date.now()
  const [from, to] = range ?? [tMax - DEFAULT_WINDOW, tMax]
  const visible = useMemo(
    () => all.filter((e) => { const l = laneOf(e, allReq); return l && !hidden.has(l) && e.ts >= from && e.ts <= to }),
    [all, hidden, allReq, from, to]
  )
  const toggle = (l: Lane): void => setHidden((h) => { const n = new Set(h); n.has(l) ? n.delete(l) : n.add(l); return n })
  const sel = selected != null ? events.get(selected) : undefined
  const open = (file: string, line: number, column?: number): void => { void window.izlix.openSource({ file, line, column, editor }) }
  const select = (id: number): void => set({ selectedEventId: id })

  return (
    <>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', padding: '4px 8px', borderBottom: '1px solid var(--line)', flexWrap: 'wrap' }}>
        <b onClick={() => setTab('timeline')} style={{ cursor: 'pointer', opacity: tab === 'timeline' ? 1 : 0.5 }}>{t('tl.timeline')}</b>
        <b onClick={() => setTab('components')} style={{ cursor: 'pointer', opacity: tab === 'components' ? 1 : 0.5 }}>{t('tl.components')}</b>
        <b onClick={() => setTab('renders')} style={{ cursor: 'pointer', opacity: tab === 'renders' ? 1 : 0.5 }}>{t('tl.renders')}</b>
        <b onClick={() => setTab('raw')} style={{ cursor: 'pointer', opacity: tab === 'raw' ? 1 : 0.5 }}>{t('tl.raw')} ({all.length})</b>
        {tab === 'timeline' && <>
          {LANES.map((l) => (
            <label key={l} style={{ color: COLOR[l] }}><input type="checkbox" checked={!hidden.has(l)} onChange={() => toggle(l)} /> {l}</label>
          ))}
          <label><input type="checkbox" checked={allReq} onChange={(e) => setAllReq(e.target.checked)} /> {t('tl.allRequests')}</label>
          {range && <button onClick={() => setRange(null)}>{t('tl.live')}</button>}
          <select value={editor} onChange={(e) => { writePref('editor', e.target.value); set({ editor: e.target.value as any }) }}>
            <option value="vscode">VS Code</option><option value="cursor">Cursor</option><option value="webstorm">WebStorm</option>
          </select>
        </>}
      </div>
      {tab === 'components' ? <Inspector height={height} /> : tab === 'renders' ? <RenderTracker events={all} range={range} /> : tab === 'raw' ? <RawList events={all} /> : (
        <>
          <Lanes events={visible} from={from} to={to} selected={selected} onSelect={select} onRange={setRange} allReq={allReq} hidden={hidden} width={width} />
          <Detail ev={sel} byId={events} onOpen={open} onSelect={select} />
        </>
      )}
    </>
  )
}

function Lanes(props: {
  events: Ev[]; width: number; from: number; to: number; selected: number | null
  onSelect(id: number): void; onRange(r: [number, number]): void; allReq: boolean; hidden: Set<Lane>
}) {
  const { events, width: W, from, to, selected, onSelect, onRange, allReq, hidden } = props
  const ref = useRef<HTMLDivElement>(null)
  const [drag, setDrag] = useState<[number, number] | null>(null)

  const lanes = LANES.filter((l) => !hidden.has(l))
  const laneY = (l: Lane): number => lanes.indexOf(l) * LANE_H + LANE_H / 2
  const span = Math.max(1, to - from)
  const x = (ts: number): number => PAD_L + ((ts - from) / span) * (W - PAD_L - PAD_R)
  const tsAt = (px: number): number => from + ((px - PAD_L) / (W - PAD_L - PAD_R)) * span
  const pos = new Map<number, { x: number; y: number }>()
  for (const e of events) { const l = laneOf(e, allReq); if (l) pos.set(e.id, { x: x(e.ts), y: laneY(l) }) }

  const step = [100, 250, 500, 1000, 2000, 5000, 10000, 30000].find((s) => span / s <= 10) ?? 60000
  const ticks: number[] = []
  for (let t = Math.ceil(from / step) * step; t <= to; t += step) ticks.push(t)
  const H = lanes.length * LANE_H + AXIS_H

  const mouse = (ev: React.MouseEvent): number => ev.clientX - (ref.current?.getBoundingClientRect().left ?? 0)

  return (
    <div ref={ref} style={{ flex: '0 0 auto', userSelect: 'none' }}>
      <svg width={W} height={H}
        onMouseDown={(ev) => setDrag([mouse(ev), mouse(ev)])}
        onMouseMove={(ev) => drag && setDrag([drag[0], mouse(ev)])}
        onMouseUp={() => {
          if (drag && Math.abs(drag[1] - drag[0]) > 6) { const a = tsAt(Math.min(...drag)), b = tsAt(Math.max(...drag)); onRange([a, b]) }
          setDrag(null)
        }}>
        <defs>
          {(['exact', 'estimated'] as const).map((c) => (
            <marker key={c} id={`ar-${c}`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
              <path d="M0,0 L8,4 L0,8 z" fill={c === 'exact' ? '#ddd' : '#999'} />
            </marker>
          ))}
        </defs>
        {lanes.map((l) => (
          <g key={l}>
            <line x1={PAD_L} x2={W - PAD_R} y1={laneY(l)} y2={laneY(l)} stroke="#2e2e30" />
            <text x={6} y={laneY(l) + 4} fill={COLOR[l]} fontSize={11}>{l}</text>
          </g>
        ))}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={0} y2={lanes.length * LANE_H} stroke="#262628" />
            <text x={x(t) + 2} y={H - 6} fill="#777" fontSize={10}>{fmtT(t - from)}</text>
          </g>
        ))}
        {/* nedensellik oklari: kesin = duz, tahmini = kesikli */}
        {events.flatMap((e) => e.links.map((lk) => {
          const a = pos.get(lk.from), b = pos.get(e.id)
          if (!a || !b) return null
          const mx = (a.x + b.x) / 2
          return (
            <path key={`${lk.from}-${e.id}`} d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x - 6},${b.y}`}
              fill="none" stroke={lk.certainty === 'exact' ? '#ddd' : '#999'} strokeWidth={1.2}
              strokeDasharray={lk.certainty === 'estimated' ? '4 3' : undefined} markerEnd={`url(#ar-${lk.certainty})`}
              opacity={selected == null || selected === e.id || selected === lk.from ? 0.9 : 0.35}>
              <title>{lk.type} ({lk.certainty === 'exact' ? 'exact' : 'estimated'})</title>
            </path>
          )
        }))}
        {events.map((e) => {
          const p = pos.get(e.id); const l = laneOf(e, allReq)
          if (!p || !l) return null
          const r = e.kind === 'render' ? Math.min(9, 4 + Math.sqrt(e.payload.count)) : 5
          return (
            <g key={e.id}>
              {e.payload.modified && <circle cx={p.x} cy={p.y} r={r + 4} fill="none" stroke="#ffb454" strokeWidth={2} strokeDasharray="3 2" />}
            <circle cx={p.x} cy={p.y} r={r} fill={COLOR[l]} stroke={selected === e.id ? '#fff' : 'none'} strokeWidth={2}
              style={{ cursor: 'pointer' }} onMouseDown={(ev) => ev.stopPropagation()} onClick={() => onSelect(e.id)}>
              <title>{label(e)}</title>
            </circle>
            </g>
          )
        })}
        {drag && <rect x={Math.min(...drag)} y={0} width={Math.abs(drag[1] - drag[0])} height={lanes.length * LANE_H} fill="#4ea1ff" opacity={0.15} />}
      </svg>
    </div>
  )
}

function Detail(props: { ev?: Ev; byId: Map<number, Ev>; onOpen(f: string, l: number, c?: number): void; onSelect(id: number): void }) {
  const { ev, byId, onOpen, onSelect } = props
  const t = useT()
  if (!ev) return <div style={{ padding: 8, opacity: 0.6 }}>{t('tl.hint')}</div>
  const p = ev.payload
  const OpenBtn = (a: { file?: string; line?: number; col?: number }) =>
    a.file && a.line ? <a href="#" onClick={(e) => { e.preventDefault(); onOpen(a.file!, a.line!, a.col) }} style={{ color: '#4ea1ff' }}>{a.file.split('/').slice(-2).join('/')}:{a.line}</a> : null
  return (
    <div style={{ padding: 8, overflow: 'auto', flex: 1, borderTop: '1px solid var(--line)' }}>
      <div><b style={{ color: COLOR[(laneOf(ev, true) ?? 'input')] }}>{ev.kind}</b> #{ev.id} · {ev.source} · {label(ev)}</div>
      <Chain ev={ev} byId={byId} onSelect={onSelect} />
      {ev.kind === 'request' && (
        <div style={{ margin: '4px 0' }}>{t('tl.ruleFrom')}{' '}
          {(['mock', 'delay', 'fail'] as const).map((k) => (
            <button key={k} className="btn" style={{ marginRight: 4 }} onClick={async () => {
              const body = k === 'mock' ? await window.izlix.responseBody(ev.tabId, p.requestId) : null
              const mime = [...byId.values()].find((x) => x.kind === 'response' && x.payload.requestId === p.requestId)?.payload.mimeType
              const st = useStore.getState(); const cfg = st.rules[st.activeWorkspaceId] ?? { rules: [], domains: ['localhost', '127.0.0.1', '*.localhost'] }
              void window.izlix.setRules(st.activeWorkspaceId, { ...cfg, rules: [...cfg.rules, ruleFromRequest(p.url, p.method, k, body, mime)] })
              st.set({ overlay: 'rules' })
            }}>{t(k === 'mock' ? 'tl.ruleMock' : k === 'delay' ? 'tl.ruleDelay' : 'tl.ruleFail')}</button>
          ))}
        </div>
      )}
      {ev.links.map((l) => (
        <div key={l.from} style={{ opacity: 0.85 }}>
          ← <a href="#" onClick={(e) => { e.preventDefault(); onSelect(l.from) }} style={{ color: '#ddd' }}>#{l.from} {byId.get(l.from) ? label(byId.get(l.from)!) : ''}</a>{' '}
          <span style={{ color: l.certainty === 'exact' ? '#3ecf8e' : '#ffb454' }}>{l.type} · {l.certainty === 'exact' ? t('tl.exact') : t('tl.estimated')}</span>
        </div>
      ))}
      {p.modified && <div style={{ color: '#ffb454' }}>{t('tl.modified', { kinds: p.modified.kinds.join(' + ') })}{p.modified.mocked ? t('tl.mockedRes') : ''}</div>}
      {p.origin && <div>{t('tl.source')}: <OpenBtn file={p.origin.file} line={p.origin.line} col={p.origin.column} /> {p.origin.component && <span>({p.origin.component})</span>}</div>}
      {ev.kind === 'render' && (
        <table style={{ marginTop: 6, borderCollapse: 'collapse', width: '100%' }}>
          <thead><tr style={{ textAlign: 'left', opacity: 0.6 }}><th>{t('tl.col.component')}</th><th>{t('tl.col.reason')}</th><th>{t('tl.col.changed')}</th><th>{t('tl.col.ms')}</th><th>{t('tl.col.source')}</th></tr></thead>
          <tbody>
            {(p.components ?? []).slice(0, 60).map((c: any, i: number) => (
              <tr key={i}>
                <td>{c.name}</td><td>{c.reason}</td>
                <td>{[...(c.props ?? []).map((k: string) => `props.${k}`), ...(c.hooks ?? []).map((h: any) => `hook[${h.index}]`)].join(', ')}</td>
                <td>{c.ms ?? ''}</td><td><OpenBtn file={c.file} line={c.line} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

/** Neden zinciri: kok nedenden secili olaya, adimlar arasi sure ve bag kesinligiyle; altinda dogrudan sonuclar. */
function Chain({ ev, byId, onSelect }: { ev: Ev; byId: Map<number, Ev>; onSelect(id: number): void }) {
  const t = useT()
  const steps = causeChain(byId, ev.id)
  const effects = effectsOf(byId.values(), ev.id)
  if (steps.length < 2 && !effects.length) return null
  const row = (e: Ev, tag: string, color: string, dt?: number, exact?: boolean): React.ReactElement => (
    <div key={e.id + tag} style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 4 }}>
      <span style={{ color: exact === false ? '#ffb454' : '#3ecf8e', width: 10 }}>{exact === false ? '┄' : '│'}</span>
      <span style={{ color: 'var(--dim)', minWidth: 48 }}>{dt != null ? `+${dt} ms` : ''}</span>
      <a href="#" onClick={(x) => { x.preventDefault(); onSelect(e.id) }} style={{ color }}>{e.kind} #{e.id} {label(e)}</a>
    </div>
  )
  return (
    <div style={{ margin: '6px 0', padding: '4px 6px', border: '1px solid var(--line)', borderRadius: 6 }}>
      {steps.length >= 2 && <>
        <div style={{ color: 'var(--dim)' }}>{t('tl.chain')}</div>
        {steps.map((s) => row(s.ev, 'c', s.ev.id === ev.id ? '#fff' : COLOR[laneOf(s.ev, true) ?? 'input'], s.dtMs, s.via ? s.via.certainty === 'exact' : undefined))}
      </>}
      {effects.length > 0 && <>
        <div style={{ color: 'var(--dim)', marginTop: 4 }}>{t('tl.effects')}</div>
        {effects.slice(0, 8).map((x) => row(x.ev, 'e', COLOR[laneOf(x.ev, true) ?? 'input'], Math.round(x.ev.ts - ev.ts), x.certainty === 'exact'))}
      </>}
    </div>
  )
}

function RawList({ events }: { events: Ev[] }) {
  return (
    <div style={{ overflow: 'auto', flex: 1, font: '11px ui-monospace, Menlo, monospace' }}>
      {events.slice(-500).reverse().map((e) => (
        <div key={e.id} style={{ padding: '1px 8px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          <span style={{ opacity: 0.5 }}>#{e.id} </span><span>{e.kind.padEnd(10)}</span><span style={{ opacity: 0.6 }}>{e.source} </span>{label(e)}
        </div>
      ))}
    </div>
  )
}
