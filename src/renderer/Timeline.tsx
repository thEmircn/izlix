import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent as Ev } from '../shared/events'
import { useStore, writePref, useT, type PanelTab } from './store'
import { Inspector, RenderTracker } from './Inspector'
import { Network } from './Network'
import { Seg } from './ui'
import { Elements } from './Elements'
import { Storage } from './Storage'
import { Perf } from './Perf'
import { A11y } from './A11y'
import { Coverage } from './Coverage'
import { Overview } from './Overview'
import { Rail } from './Rail'
import { LANES, LANE_COLOR as COLOR, eventLabel as label, shortUrl, type Lane } from '../shared/label'
import { Profiler } from './Profiler'
import { Seo } from './Seo'
import { Server } from './Server'
import { Sources } from './Sources'
import { ErrorBoundary } from './ErrorBoundary'
import { Console } from './Console'
import { causeChain, effectsOf, sinceNavigation } from '../shared/chain'
import { ruleFromRequest } from '../shared/rules'

// ---- sabitler ----
const LANE_H = 30, PAD_L = 62, PAD_R = 14, AXIS_H = 20, DEFAULT_WINDOW = 15_000
const NET_TYPES = ['Fetch', 'XHR', 'Document']

function laneOf(e: Ev, allReq: boolean): Lane | null {
  switch (e.kind) {
    case 'input': return 'input'
    case 'request': return allReq || NET_TYPES.includes(e.payload.type) ? 'request' : null
    case 'response': return allReq || NET_TYPES.includes(e.payload.type) ? 'response' : null
    case 'render': return e.payload.count > 0 ? 'render' : null
    case 'error': return 'error'
    case 'hmr': return 'hmr'
    case 'console': return 'console'
    default: return null
  }
}

const fmtT = (ms: number): string => (ms / 1000).toFixed(2) + 's'

type PTab = PanelTab
/** Unified Developer Timeline v0: 6 serit, kesin (duz) / tahmini (kesikli) oklar, filtre, aralik secimi. */
export function Timeline({ width, height }: { width: number; height: number }) {
  const t = useT()
  const events = useStore((s) => s.events)
  const activeTabId = useStore((s) => s.activeTabId)
  const selected = useStore((s) => s.selectedEventId)
  const editor = useStore((s) => s.editor)
  const set = useStore((s) => s.set)
  const preserve = useStore((s) => s.preserveLog)
  const tab = useStore((s) => s.panelTab)
  const setTab = (k: PTab): void => set({ panelTab: k })
  const [hidden, setHidden] = useState<Set<Lane>>(new Set())
  const [allReq, setAllReq] = useState(false)
  const [tq, setTq] = useState('')
  const [range, setRange] = useState<[number, number] | null>(null)
  const mainRef = useRef<HTMLDivElement>(null)
  const [mainW, setMainW] = useState(width - 52)
  useEffect(() => { const el = mainRef.current; if (!el) return; const ro = new ResizeObserver(() => setMainW(el.clientWidth)); ro.observe(el); setMainW(el.clientWidth); return () => ro.disconnect() }, [])

  // kuzey yildizi metrigi (plan bolum 10): Timeline'in acildigi Workspace; sekme basina bir kez, yalnizca sayilar
  const sent = useRef(new Set<string>())
  const wsId = useStore((s) => s.activeWorkspaceId)
  const snapshot = useStore((s) => s.snapshot)
  const all = useMemo(() => snapshot ? [...snapshot.events].sort((a, b) => a.ts - b.ts) : [...events.values()].filter((e) => e.tabId === activeTabId).sort((a, b) => a.ts - b.ts), [events, activeTabId, snapshot])
  const src = useMemo(() => snapshot ? new Map(snapshot.events.map((e) => [e.id, e])) : events, [snapshot, events])
  useEffect(() => {
    if (!activeTabId || tab !== 'timeline' || !all.length) return
    if (!sent.current.has('open:' + wsId)) { sent.current.add('open:' + wsId); void window.izlix.track('timeline.open', { events: all.length }) }
    if (!sent.current.has('chain') && all.some((e) => e.links.some((l) => l.certainty === 'exact'))) { sent.current.add('chain'); void window.izlix.track('chain.seen') }
  }, [all, tab, activeTabId, wsId])
  const tMax = all.length ? all[all.length - 1].ts : Date.now()
  // Varsayilan aralik: son 15 sn icindeki verinin kapsadigi bolge (en az 2 sn); olaylar sagda sikismasin
  const recentStart = all.find((e) => e.ts >= tMax - DEFAULT_WINDOW)?.ts ?? tMax - DEFAULT_WINDOW
  const autoSpan = Math.max(2000, tMax - recentStart)
  const [from, to] = range ?? [tMax - autoSpan * 1.06, tMax + autoSpan * 0.03]
  const visible = useMemo(
    () => all.filter((e) => { const l = laneOf(e, allReq); return l && !hidden.has(l) && e.ts >= from && e.ts <= to && (!tq || label(e).toLowerCase().includes(tq.toLowerCase())) }),
    [all, hidden, allReq, from, to, tq]
  )
  const toggle = (l: Lane): void => setHidden((h) => { const n = new Set(h); n.has(l) ? n.delete(l) : n.add(l); return n })
  const sel = selected != null ? src.get(selected) : undefined
  const open = (file: string, line: number, column?: number): void => { void window.izlix.openSource({ file, line, column, editor }) }
  const select = (id: number): void => set({ selectedEventId: id })

  const labels = { overview: t('tl.overview'), timeline: t('tl.timeline'), network: t('tl.network'), console: t('tl.console'), elements: t('tl.elements'), sources: t('tl.sources'), storage: t('tl.storage'), perf: t('tl.perf'), coverage: t('tl.coverage'), a11y: t('tl.a11y'), profiler: t('tl.profiler'), seo: t('tl.seo'), server: t('tl.server'), components: t('tl.components'), renders: t('tl.renders'), raw: `${t('tl.raw')} (${all.length})` } as Record<PanelTab, string>

  return (
    <div className="pbody">
      <Rail value={tab} onChange={setTab} labels={labels} />
      <div className="pmain" ref={mainRef}>
      <div className="phead">
        <span className="mlabel">{labels[tab].replace(/ \(\d+\)$/, '')}</span>
        {tab === 'timeline' && <>
          {LANES.map((l) => (
            <button key={l} type="button" aria-pressed={!hidden.has(l)} className={`lane-chip ${hidden.has(l) ? 'off' : ''}`} style={{ ['--c' as any]: COLOR[l] }} onClick={() => toggle(l)}>{l}</button>
          ))}
          <button type="button" aria-pressed={allReq} className={`lane-chip ${allReq ? '' : 'off'}`} style={{ ['--c' as any]: '#8b8ba0' }} onClick={() => setAllReq(!allReq)}>{t('tl.allRequests')}</button>
          <input className="search" style={{ maxWidth: 150 }} placeholder={t('tl.search')} value={tq} onChange={(e) => setTq(e.target.value)} />
          {range && <button className="btn" onClick={() => setRange(null)}>{t('tl.live')}</button>}
          <select className="mini-select" value={editor} onChange={(e) => { writePref('editor', e.target.value); set({ editor: e.target.value as any }) }}>
            <option value="vscode">VS Code</option><option value="cursor">Cursor</option><option value="webstorm">WebStorm</option>
          </select>
        </>}
      </div>
      {snapshot && <div className="snapbar"><span>{t('snap.viewing', { n: snapshot.name })}</span><button className="btn sm" onClick={() => set({ snapshot: null, selectedEventId: null })}>{t('snap.close')}</button></div>}
      <ErrorBoundary label={tab}>
      {tab === 'timeline' && all.length === 0 && <div className="empty-hint">{t('tl.empty')}</div>}
      {tab === 'network' ? <Network events={preserve ? all : sinceNavigation(all)} byId={src} /> : tab === 'console' ? <Console events={preserve ? all : sinceNavigation(all)} /> : tab === 'overview' ? <Overview events={preserve ? all : sinceNavigation(all)} /> : tab === 'elements' ? <Elements /> : tab === 'sources' ? <Sources events={all} /> : tab === 'storage' ? <Storage /> : tab === 'perf' ? <Perf events={all} /> : tab === 'a11y' ? <A11y /> : tab === 'profiler' ? <Profiler /> : tab === 'coverage' ? <Coverage /> : tab === 'seo' ? <Seo /> : tab === 'server' ? <Server /> : tab === 'components' ? <Inspector height={height} /> : tab === 'renders' ? <RenderTracker events={all} range={range} /> : tab === 'raw' ? <RawList events={all} /> : (
        <>
          <Lanes markers={all.filter((e) => e.kind === 'marker' && e.ts >= from && e.ts <= to)} events={visible} from={from} to={to} selected={selected} onSelect={select} onRange={setRange} allReq={allReq} hidden={hidden} width={mainW} />
          <Detail ev={sel} byId={src} onOpen={open} onSelect={select} />
        </>
      )}
      </ErrorBoundary>
      </div>
    </div>
  )
}

function Lanes(props: {
  markers: Ev[]; events: Ev[]; width: number; from: number; to: number; selected: number | null
  onSelect(id: number): void; onRange(r: [number, number]): void; allReq: boolean; hidden: Set<Lane>
}) {
  const { events, markers, width: W, from, to, selected, onSelect, onRange, allReq, hidden } = props
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
        onWheel={(ev) => {
          // tekerlek: imlec etrafinda yakinlastir/uzaklastir; shift+tekerlek: yatay kaydir
          const x0 = ev.clientX - (ref.current?.getBoundingClientRect().left ?? 0)
          if (ev.shiftKey || Math.abs(ev.deltaX) > Math.abs(ev.deltaY)) { const dt = ((ev.deltaX || ev.deltaY) / (W - PAD_L - PAD_R)) * span; onRange([from + dt, to + dt]); return }
          const f = Math.exp(ev.deltaY * 0.0015), at = tsAt(x0)
          const nf = at - (at - from) * f, nt = at + (to - at) * f
          if (nt - nf >= 200) onRange([nf, nt])
        }}
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
            <path className="link" key={`${lk.from}-${e.id}`} d={`M${a.x},${a.y} C${mx},${a.y} ${mx},${b.y} ${b.x - 6},${b.y}`}
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
            <circle className="node" cx={p.x} cy={p.y} r={r} fill={COLOR[l]} stroke={selected === e.id ? '#fff' : 'none'} strokeWidth={2}
              style={{ cursor: 'pointer' }} onMouseDown={(ev) => ev.stopPropagation()} onClick={() => onSelect(e.id)}>
              <title>{label(e)}</title>
            </circle>
            </g>
          )
        })}
        {markers.map((m) => (
          <g key={m.id} className="marker" style={{ cursor: 'pointer' }} onMouseDown={(ev) => ev.stopPropagation()} onClick={() => onSelect(m.id)}>
            <line x1={x(m.ts)} x2={x(m.ts)} y1={0} y2={lanes.length * LANE_H} stroke="#fbbf24" strokeWidth={1.5} strokeDasharray="4 3" opacity={selected === m.id ? 1 : 0.75} />
            <path d={`M${x(m.ts)},0 l10,4 l-10,4 z`} fill="#fbbf24" /><title>{String(m.payload.text)}</title>
            <text x={x(m.ts) + 13} y={9} fill="#fbbf24" fontSize={10}>{String(m.payload.text).slice(0, 24)}</text>
          </g>
        ))}
        {drag && <rect x={Math.min(...drag)} y={0} width={Math.abs(drag[1] - drag[0])} height={lanes.length * LANE_H} fill="#f4f4f5" opacity={0.15} />}
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
    a.file && a.line ? <a href="#" onClick={(e) => { e.preventDefault(); onOpen(a.file!, a.line!, a.col) }} style={{ color: '#f4f4f5' }}>{a.file.split('/').slice(-2).join('/')}:{a.line}</a> : null
  return (
    <div style={{ padding: 8, overflow: 'auto', flex: 1, borderTop: '1px solid var(--line)' }}>
      <div><b style={{ color: ev.kind === 'marker' ? '#fbbf24' : COLOR[(laneOf(ev, true) ?? 'input')] }}>{ev.kind}</b> #{ev.id} · {ev.source} · {label(ev)}</div>
      <Chain ev={ev} byId={byId} onSelect={onSelect} />
      {ev.kind === 'request' && <QuickRules ev={ev} byId={byId} />}
      {ev.links.map((l) => (
        <div key={l.from} style={{ opacity: 0.85 }}>
          ← <a href="#" onClick={(e) => { e.preventDefault(); onSelect(l.from) }} style={{ color: '#ddd' }}>#{l.from} {byId.get(l.from) ? label(byId.get(l.from)!) : ''}</a>{' '}
          <span style={{ color: l.certainty === 'exact' ? '#a3e635' : '#ffb454' }}>{l.type} · {l.certainty === 'exact' ? t('tl.exact') : t('tl.estimated')}</span>
        </div>
      ))}
      {p.modified && <div style={{ color: '#ffb454' }}>{t('tl.modified', { kinds: p.modified.kinds.join(' + ') })}{p.modified.mocked ? t('tl.mockedRes') : ''}</div>}
      {p.origin && <div>{t('tl.source')}: <OpenBtn file={p.origin.file} line={p.origin.line} col={p.origin.column} /> {p.origin.component && <span>({p.origin.component})</span>}</div>}
      {ev.kind === 'render' && (
        <table className="tbl" style={{ marginTop: 6 }}>
          <thead><tr><th>{t('tl.col.component')}</th><th>{t('tl.col.reason')}</th><th>{t('tl.col.changed')}</th><th>{t('tl.col.ms')}</th><th>{t('tl.col.source')}</th></tr></thead>
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

export function QuickRules({ ev, byId }: { ev: Ev; byId: Map<number, Ev> }) {
  const t = useT()
  const p = ev.payload
  return (
    <div className="quick-rules">{t('tl.ruleFrom')}{' '}
      {(['mock', 'delay', 'fail', 'block'] as const).map((k) => (
        <button key={k} className="btn" onClick={async () => {
          const body = k === 'mock' ? await window.izlix.responseBody(ev.tabId, p.requestId) : null
          const mime = [...byId.values()].find((x) => x.kind === 'response' && x.payload.requestId === p.requestId)?.payload.mimeType
          const st = useStore.getState(); const cfg = st.rules[st.activeWorkspaceId] ?? { rules: [], domains: ['localhost', '127.0.0.1', '*.localhost'] }
          void window.izlix.setRules(st.activeWorkspaceId, { ...cfg, rules: [...cfg.rules, ruleFromRequest(p.url, p.method, k, body, mime)] })
          st.set({ overlay: 'rules' })
        }}>{t(k === 'mock' ? 'tl.ruleMock' : k === 'delay' ? 'tl.ruleDelay' : k === 'block' ? 'tl.ruleBlock' : 'tl.ruleFail')}</button>
      ))}
    </div>
  )
}

/** Neden zinciri: kok nedenden secili olaya, adimlar arasi sure ve bag kesinligiyle; altinda dogrudan sonuclar. */
export function Chain({ ev, byId, onSelect }: { ev: Ev; byId: Map<number, Ev>; onSelect(id: number): void }) {
  const t = useT()
  const steps = causeChain(byId, ev.id)
  const effects = effectsOf(byId.values(), ev.id)
  if (steps.length < 2 && !effects.length) return null
  const row = (e: Ev, tag: string, color: string, dt?: number, exact?: boolean): React.ReactElement => (
    <div key={e.id + tag} style={{ display: 'flex', gap: 6, alignItems: 'baseline', paddingLeft: 4 }}>
      <span style={{ color: exact === false ? '#ffb454' : '#a3e635', width: 10 }}>{exact === false ? '┄' : '│'}</span>
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
