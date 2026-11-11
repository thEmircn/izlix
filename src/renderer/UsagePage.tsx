import { useEffect, useState } from 'react'
import { totalSec, topSites } from '../shared/usage'
import { useT } from './store'
import { Kbd } from './ui'

const fmt = (s: number): string => { const m = Math.round(s / 60); return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : s >= 60 ? `${m}m` : `${s}s` }

/** Sitelerde gecirilen sure: bugunun en cok vakit alan siteleri ve son 7 gunun gunluk toplami. */
export function UsagePage({ onClose }: { onClose(): void }) {
  const t = useT()
  const [data, setData] = useState<{ days: string[]; usage: Record<string, Record<string, number>> } | null>(null)
  useEffect(() => { void window.izlix.usageGet(7).then(setData) }, [])
  if (!data) return null
  const today = data.days[data.days.length - 1]
  const tops = topSites(data.usage, [today], 12), week = topSites(data.usage, data.days, 8)
  const totals = data.days.map((d) => ({ d, s: totalSec(data.usage, d) })), max = Math.max(1, ...totals.map((x) => x.s))
  const empty = totals.every((x) => x.s === 0)
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog dl" role="dialog" aria-label={t('usage.title')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('usage.title')}</b><span style={{ flex: 1 }} /><Kbd>esc</Kbd></div>
        <div className="dl-list">
          {empty && <div className="hub-empty">{t('usage.none')}</div>}
          {!empty && <>
            <div className="usage-week">{totals.map((x) => <div key={x.d} className="usage-day" title={`${x.d}: ${fmt(x.s)}`}><i style={{ height: `${Math.max(3, (x.s / max) * 100)}%` }} /><small>{x.d.slice(8)}</small></div>)}</div>
            <h4 className="note-page" style={{ cursor: 'default' }}>{t('usage.today')} · {fmt(totalSec(data.usage, today))}</h4>
            {tops.map((x) => <div className="usage-row" key={x.site}><span>{x.site}</span><div className="dl-bar"><i style={{ width: `${(x.sec / (tops[0]?.sec || 1)) * 100}%` }} /></div><code>{fmt(x.sec)}</code></div>)}
            <h4 className="note-page" style={{ cursor: 'default' }}>{t('usage.week')}</h4>
            {week.map((x) => <div className="usage-row" key={x.site}><span>{x.site}</span><div className="dl-bar"><i style={{ width: `${(x.sec / (week[0]?.sec || 1)) * 100}%` }} /></div><code>{fmt(x.sec)}</code></div>)}
          </>}
        </div>
      </div>
    </div>
  )
}
