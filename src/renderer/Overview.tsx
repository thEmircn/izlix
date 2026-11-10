import { useEffect, useMemo, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { LANE_COLOR, eventLabel, type Lane } from '../shared/label'
import { formatBytes, formatMs } from '../shared/network'
import { summarizeOverview } from '../shared/overview'
import { toast, useStore, useT, wsName } from './store'
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
  const tabId = useStore((s) => s.activeTabId)
  const url = useStore((s) => s.tabs.find((x) => x.id === s.activeTabId)?.url ?? '')
  const host = (() => { try { return new URL(url).host } catch { return '' } })()
  const scoreColor = o.score >= 80 ? 'var(--ok)' : o.score >= 50 ? 'var(--warn)' : 'var(--bad)'
  const [fw, setFw] = useState<{ id: string; name: string; version: string; supported: boolean }[]>([])
  useEffect(() => { if (!tabId) return; let live = true; const run = (): void => { void window.izlix.frameworks(tabId).then((d: any) => { if (live) setFw(d ?? []) }) }; run(); const h = setInterval(run, 4000); return () => { live = false; clearInterval(h) } }, [tabId, url])
  const go = (id: number): void => set({ panelTab: 'timeline', selectedEventId: id })
  return (
    <div className="ov">
      <div className="ov-head">
        <div><div className="ov-sub">{wsName(ws)}</div><div className="ov-host">{host}</div>{fw.length > 0 && <div className="fw-chips">{fw.map((f) => <span key={f.id} className={`rchip ${f.supported ? 'ac' : ''}`} title={f.supported ? t('fw.supported') : t('fw.unsupported')}>{f.name}{f.version ? ` ${f.version}` : ''}</span>)}</div>}</div>
        <span className={`pill ${o.healthy ? 'ok' : 'bad'}`}><i />{o.healthy ? t('ov.healthy') : t('ov.issues', { n: o.errors + o.failed })}</span>
      </div>
      <div className="bento">
        <div className="tile full hero">
          <Donut size={118} thickness={12} segments={[{ value: o.score, color: scoreColor, label: 'score' }, { value: 100 - o.score, color: 'transparent', label: 'rest' }]}>
            <div className="score"><b><CountUp value={o.score} /></b><small>{t(o.score >= 80 ? 'ov.scoreGood' : o.score >= 50 ? 'ov.scoreMid' : 'ov.scoreBad')}</small></div>
          </Donut>
          <div className="hero-r">
            <div className="mlabel">{t('ov.score')}</div>
            <div className="parts">
              {([['ov.net', o.parts.net], ['ov.con', o.parts.con], ['ov.perf', o.parts.perf]] as [string, number | null][]).map(([k, v]) => (
                <div key={k} className="part"><span>{t(k as any)}</span><div className="covbar prof-bar"><b style={{ width: `${v ?? 0}%`, background: v == null ? 'transparent' : v >= 80 ? 'var(--ok)' : v >= 50 ? 'var(--warn)' : 'var(--bad)' }} /></div><code>{v == null ? '—' : v}</code></div>
              ))}
            </div>
            <div className="qa">
              <button className="btn" disabled={!tabId} onClick={() => tabId && void window.izlix.reload(tabId)}>{t('ov.reload')}</button>
              <button className="btn" onClick={() => set({ overlay: 'marker' })}>{t('ov.marker')}</button>
              <button className="btn" onClick={() => { void window.izlix.exportReport().then((p: string | null) => { if (p) toast(t('toast.report', { p: p.split('/').pop() ?? '' })) }) }}>{t('ov.report')}</button>
            </div>
          </div>
        </div>
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

        <div className="tile full">
          <div className="mlabel">{t('ov.vitals')}</div>
          {o.vitals.length ? (
            <div className="vrings">
              {o.vitals.map((v) => {
                const c = v.rating === 'good' ? 'var(--ok)' : v.rating === 'needs' ? 'var(--warn)' : 'var(--bad)'
                const txt = v.unit === 'ms' ? (v.value >= 1000 ? `${(v.value / 1000).toFixed(1)}s` : `${Math.round(v.value)}`) : v.value.toFixed(2)
                return (
                  <div key={v.name} className="vring">
                    <Donut size={62} thickness={7} segments={[{ value: Math.max(0.14, Math.min(1, v.value / v.max)), color: c, label: v.name }, { value: 1 - Math.max(0.14, Math.min(1, v.value / v.max)), color: 'transparent', label: 'rest' }]}><b className="vr-n">{txt}</b></Donut>
                    <span>{v.name}</span>
                  </div>
                )
              })}
            </div>
          ) : <div className="tsub">{t('ov.noVitals')}</div>}
        </div>
        <div className="tile wide">
          <div className="mlabel">{t('ov.renders')} <span className="mdim">{o.commits} commit · {o.renders} render</span></div>
          {o.hot.length ? o.hot.map((h) => (
            <div key={h.name} className="hrow"><span>{h.name}</span><div className="covbar prof-bar"><b style={{ width: `${(h.totalMs / maxHot) * 100}%` }} /></div><code>{h.renders}×</code></div>
          )) : <div className="tsub">{t('ov.noRenders')}</div>}
        </div>

        <div className="tile wide">
          <div className="mlabel">{t('ov.slowest')}</div>
          {o.slowest.length ? o.slowest.map((r) => (
            <button key={r.id} className="act slow" onClick={() => set({ panelTab: 'network', selectedEventId: r.id })}>
              <i style={{ background: (r.status ?? 0) >= 400 ? 'var(--bad)' : 'var(--ok)' }} /><code>{r.method}</code><span>{r.name}</span><em>{formatMs(Math.round(r.ms))}</em>
              <div className="slowbar" style={{ width: `${(r.ms / Math.max(1, o.slowest[0].ms)) * 100}%` }} />
            </button>
          )) : <div className="tsub">{t('ov.noTraffic')}</div>}
        </div>
        <div className="tile wide">
          <div className="mlabel">{t('ov.recentErr')}</div>
          {o.recent.length ? o.recent.map((r) => (
            <button key={`${r.kind}${r.id}`} className="act" onClick={() => r.kind === 'net' ? set({ panelTab: 'network', selectedEventId: r.id }) : set({ panelTab: 'console' })}>
              <i style={{ background: 'var(--bad)' }} /><code>{r.kind === 'net' ? 'net' : 'js'}</code><span>{r.text}</span><em />
            </button>
          )) : <div className="tsub ok-note">{t('ov.noErrors')}</div>}
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
