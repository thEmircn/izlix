import { useEffect, useMemo, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { summarizeVitals } from '../shared/vitals'
import { useStore, useT } from './store'
import { CountUp, Spark } from './ui'
import { BudgetPanel } from './BudgetChip'
import { leakHint, mb, metricMap } from '../shared/metrics'

const fmt = (v: number, unit: string): { n: number; dec: number; u: string } => unit === 'ms' ? (v >= 1000 ? { n: v / 1000, dec: 2, u: 's' } : { n: v, dec: 0, u: 'ms' }) : { n: v, dec: 3, u: '' }

/** Performance paneli: Web Vitals kartlari, uzun gorevler ve TBT. */
export function Perf({ events }: { events: BusEvent[] }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const sum = useMemo(() => summarizeVitals(events), [events])
  // Bellek / DOM izleme: panel acikken saniyede bir Performance.getMetrics
  const [series, setSeries] = useState<Record<string, number[]>>({})
  useEffect(() => {
    if (!tabId) return
    setSeries({})
    let live = true
    void window.izlix.dtEnable(tabId, 'perf')
    const poll = async (): Promise<void> => {
      const r: any = await window.izlix.dt(tabId, 'Performance.getMetrics').catch(() => null)
      if (!live || !r?.metrics) return
      const m = metricMap(r.metrics)
      setSeries((prev) => {
        const next = { ...prev }
        for (const k of ['JSHeapUsedSize', 'Nodes', 'JSEventListeners', 'Documents']) next[k] = [...(prev[k] ?? []), m[k] ?? 0].slice(-90)
        return next
      })
    }
    void poll(); const h = setInterval(() => void poll(), 1000)
    return () => { live = false; clearInterval(h); void window.izlix.dtDisable(tabId, 'perf') }
  }, [tabId])
  const cur = (k: string): number => (series[k] ?? [0]).slice(-1)[0] ?? 0
  const maxTask = Math.max(100, ...sum.longTasks.map((x) => x.ms))
  return (
    <div className="perf">
      <div className="net-bar"><span style={{ color: 'var(--dim)' }}>{t('perf.hint')}</span><span style={{ flex: 1 }} /><button className="btn" onClick={() => tabId && void window.izlix.reload(tabId)}>{t('perf.measure')}</button></div>
      <BudgetPanel events={events} />
      <div className="vgrid">
        {sum.vitals.map((v) => {
          const f = fmt(v.value, v.unit)
          return (
            <div key={v.name} className={`vcard ${v.rating}`}>
              <div className="vname">{v.name}<i className="vdot" /></div>
              <div className="vnum"><CountUp value={f.n} decimals={f.dec} /><small>{f.u}</small></div>
              <div className="gauge"><b style={{ width: `${Math.min(100, (v.value / v.max) * 100)}%` }} /></div>
              <div className="vdetail">{t(`perf.${v.rating}` as any)}{v.detail ? ` · ${v.detail}` : ''}</div>
            </div>
          )
        })}
        {!sum.vitals.length && <div className="empty-hint" style={{ gridColumn: '1 / -1' }}>{t('perf.empty')}</div>}
      </div>
      <div className="net-stats">
        <div className="stat"><span>TBT</span><b className={sum.tbt > 200 ? 'bad' : ''}>{sum.tbt} ms</b></div>
        <div className="stat"><span title="DOMContentLoaded">DCL</span><b>{sum.dcl != null ? `${Math.round(sum.dcl)} ms` : '—'}</b></div>
        <div className="stat"><span>{t('perf.load')}</span><b>{sum.load != null ? `${Math.round(sum.load)} ms` : '—'}</b></div>
        <div className="stat"><span>{t('perf.shifts')}</span><b>{sum.shifts}</b></div>
      </div>
      <h4 className="sec">{t('perf.memory')}</h4>
      <div className="mgrid">
        {([['JSHeapUsedSize', t('perf.heap'), (v: number) => mb(v)], ['Nodes', t('perf.nodes'), (v: number) => String(v)], ['JSEventListeners', t('perf.listeners'), (v: number) => String(v)]] as [string, string, (v: number) => string][]).map(([k, label, f]) => (
          <div key={k} className={`mcard ${leakHint(series[k] ?? []) ? 'leak' : ''}`}>
            <div className="vname">{label}{leakHint(series[k] ?? []) && <em className="leakbadge">{t('perf.leak')}</em>}</div>
            <div className="vnum" style={{ fontSize: 20 }}>{f(cur(k))}</div>
            <Spark values={series[k] ?? []} color={leakHint(series[k] ?? []) ? '#f87171' : '#d4d4d8'} />
          </div>
        ))}
      </div>
      <h4 className="sec">{t('perf.longTasks')} ({sum.longTasks.length})</h4>
      <div className="tasks">
        {sum.longTasks.slice(-30).map((x, i) => <div key={i} className="task"><span>{Math.round(x.start)} ms</span><div><b style={{ width: `${(x.ms / maxTask) * 100}%` }} className={x.ms > 200 ? 'bad' : ''} /></div><code>{Math.round(x.ms)} ms</code></div>)}
        {!sum.longTasks.length && <div className="empty-hint">{t('perf.noTasks')}</div>}
      </div>
    </div>
  )
}
