import { useMemo } from 'react'
import type { BusEvent } from '../shared/events'
import { LANE_COLOR, eventLabel, type Lane } from '../shared/label'
import { formatBytes, formatMs } from '../shared/network'
import { summarizeOverview } from '../shared/overview'
import { useStore, useT, wsName } from './store'
import { CountUp, Donut, Spark } from './ui'
import { LiveTraffic } from './LiveTraffic'

const TYPE_COLORS = ['#ff6a2b', '#f5b83d', '#5ad08a', '#a1a1aa', '#2dd4bf', '#d4d4d8', '#71717a', '#8b8b92']
const laneOf = (e: BusEvent): Lane => (e.kind === 'navigation' || e.kind === 'marker' ? 'input' : (e.kind as Lane))
const clock = (ts: number, t0: number): string => `+${((ts - t0) / 1000).toFixed(1)}s`

/** Overview: sayfanin durumunu tek bakista gosteren bento gosterge paneli. */
export function Overview({ events }: { events: BusEvent[] }) {
  const t = useT()
  const lang = useStore((s) => s.settings.language)
  const laneName = (k: string): string => { const key = `lane.${k}` as any; const v = t(key); return v === key ? k : v }
  const set = useStore((s) => s.set)
  const ws = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
  const nRules = useStore((s) => (s.rules[s.activeWorkspaceId]?.rules ?? []).filter((r) => r.enabled).length)
  const o = useMemo(() => summarizeOverview(events), [events])
  const t0 = events.length ? events[0].ts : 0
  const maxHot = Math.max(1, ...o.hot.map((h) => h.totalMs))
  const go = (id: number): void => set({ panelTab: 'timeline', selectedEventId: id })
  return (
    <div className="ov">
      <div className="ov-head">
        <div className="ov-sub">{wsName(ws)}</div>
        <span className={`pill ${o.healthy ? 'ok' : 'bad'}`}><i />{o.healthy ? t('ov.healthy') : t('ov.issues', { n: o.errors + o.failed })}</span>
      </div>
      <div className="bento">
        <div className="tile">
          <div className="mlabel">{t('ov.requests')}</div>
          <div className="big"><CountUp value={o.requests} /></div>
          <Spark values={o.reqSeries} color="var(--ac)" height={34} format={(v) => `${v}`} />
        </div>
        <div className={`tile ${o.failed ? 'warn' : ''}`}>
          <div className="mlabel">{t('ov.failed')}</div>
          <div className="tile-ring">
            <div><div className="big"><CountUp value={o.failed} /></div><div className="tsub">{o.requests ? t('ov.ofReq', { p: Math.round((o.failed / o.requests) * 100) }) : '—'}</div></div>
            <Donut size={58} thickness={7} segments={[{ value: Math.max(0, o.requests - o.failed), color: 'var(--ok)', label: 'ok' }, { value: o.failed, color: 'var(--bad)', label: 'failed' }]} />
          </div>
        </div>
        <div className="tile">
          <div className="mlabel">{t('ov.transfer')}</div>
          <div className="big">{o.bytes ? formatBytes(o.bytes) : '0 B'}</div>
          <div className="tsub">{t('ov.p95')}: {o.p95 != null ? formatMs(Math.round(o.p95)) : '—'}</div>
        </div>
        <div className={`tile ${o.errors ? 'bad' : ''}`}>
          <div className="mlabel">{t('ov.console')}</div>
          <div className="big"><CountUp value={o.errors} /><small>{t('ov.errors')}</small></div>
          <div className="tsub" title={o.lastError ?? ''}>{o.lastError ?? t('ov.warnings', { n: o.warns })}</div>
        </div>

        <div className="tile full live-tile">
          <div className="mlabel">{t('ov.live')}</div>
          <LiveTraffic events={events} height={150} />
        </div>
        <div className="tile wide">
          <div className="mlabel">{t('ov.byType')}</div>
          {o.types.length ? (
            <div className="tile-ring">
              <Donut size={92} thickness={10} segments={o.types.map((x, i) => ({ value: x.bytes || 0.0001, color: TYPE_COLORS[i % TYPE_COLORS.length], label: x.type }))}>
                <b>{o.types.reduce((a, x) => a + x.count, 0)}</b>
              </Donut>
              <div className="legend">{o.types.slice(0, 5).map((x, i) => <div key={x.type}><i style={{ background: TYPE_COLORS[i % TYPE_COLORS.length] }} /><span>{x.type}</span><code>{formatBytes(x.bytes)}</code></div>)}</div>
            </div>
          ) : <div className="tsub">{t('ov.noTraffic')}</div>}
        </div>

        <div className="tile wide">
          <div className="mlabel">{t('ov.vitals')}</div>
          {o.vitals.length ? (
            <div className="vrow">
              {o.vitals.map((v) => (
                <div key={v.name} className={`vmini ${v.rating}`}>
                  <span>{v.name}</span>
                  <b>{v.unit === 'ms' ? (v.value >= 1000 ? `${(v.value / 1000).toFixed(2)}s` : `${Math.round(v.value)}ms`) : v.value.toFixed(3)}</b>
                  <div className="gauge"><b style={{ width: `${Math.min(100, (v.value / v.max) * 100)}%` }} /></div>
                </div>
              ))}
            </div>
          ) : <div className="tsub">{t('ov.noVitals')}</div>}
        </div>
        <div className="tile wide">
          <div className="mlabel">{t('ov.renders')} <span className="mdim">{o.commits} commit · {o.renders} render</span></div>
          {o.hot.length ? o.hot.map((h) => (
            <div key={h.name} className="hrow"><span>{h.name}</span><div className="covbar prof-bar"><b style={{ width: `${(h.totalMs / maxHot) * 100}%` }} /></div><code>{h.renders}×</code></div>
          )) : <div className="tsub">{t('ov.noRenders')}</div>}
        </div>

        <div className="tile full">
          <div className="mlabel">{t('ov.activity')} <span className="mdim">{ws?.servers.length ? t('ov.servers', { n: ws.servers.length }) : ''}{nRules ? ` · ${t('ov.rules', { n: nRules })}` : ''}</span></div>
          {o.activity.length ? o.activity.map((e) => (
            <button key={e.id} className="act" onClick={() => go(e.id)}>
              <i style={{ background: LANE_COLOR[laneOf(e)] }} /><code>{clock(e.ts, t0)}</code><span>{eventLabel(e, lang)}</span><em>{laneName(e.kind)}</em>
            </button>
          )) : <div className="tsub">{t('tl.empty')}</div>}
        </div>
      </div>
    </div>
  )
}
