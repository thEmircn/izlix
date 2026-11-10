import { useMemo } from 'react'
import type { BusEvent } from '../shared/events'
import { summarizeVitals } from '../shared/vitals'
import { useStore, useT } from './store'
import { CountUp } from './ui'

const fmt = (v: number, unit: string): { n: number; dec: number; u: string } => unit === 'ms' ? (v >= 1000 ? { n: v / 1000, dec: 2, u: 's' } : { n: v, dec: 0, u: 'ms' }) : { n: v, dec: 3, u: '' }

/** Performance paneli: Web Vitals kartlari, uzun gorevler ve TBT. */
export function Perf({ events }: { events: BusEvent[] }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const sum = useMemo(() => summarizeVitals(events), [events])
  const maxTask = Math.max(100, ...sum.longTasks.map((x) => x.ms))
  return (
    <div className="perf">
      <div className="net-bar"><span style={{ color: 'var(--dim)' }}>{t('perf.hint')}</span><span style={{ flex: 1 }} /><button className="btn" onClick={() => tabId && void window.izlix.reload(tabId)}>{t('perf.measure')}</button></div>
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
        <div className="stat"><span>DOMContentLoaded</span><b>{sum.dcl != null ? `${Math.round(sum.dcl)} ms` : '—'}</b></div>
        <div className="stat"><span>Load</span><b>{sum.load != null ? `${Math.round(sum.load)} ms` : '—'}</b></div>
        <div className="stat"><span>{t('perf.shifts')}</span><b>{sum.shifts}</b></div>
      </div>
      <h4 className="sec">{t('perf.longTasks')} ({sum.longTasks.length})</h4>
      <div className="tasks">
        {sum.longTasks.slice(-30).map((x, i) => <div key={i} className="task"><span>{Math.round(x.start)} ms</span><div><b style={{ width: `${(x.ms / maxTask) * 100}%` }} className={x.ms > 200 ? 'bad' : ''} /></div><code>{Math.round(x.ms)} ms</code></div>)}
        {!sum.longTasks.length && <div className="empty-hint">{t('perf.noTasks')}</div>}
      </div>
    </div>
  )
}
