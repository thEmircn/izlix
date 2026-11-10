import { useEffect, useMemo } from 'react'
import { Overview } from './Overview'
import { useStore, useT, useThrottled } from './store'
import { Close } from './icons'

/** Tam ekran dashboard: sayfanin sagligi, canli trafik, vitals vb. tek duz sayfada. Sag panelden bagimsizdir; Esc veya düğmeyle kapanir. */
export function DashboardView({ top }: { top: number }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const raw = useStore((s) => s.events)
  const set = useStore((s) => s.set)
  const events = useThrottled(raw, raw.size > 600 ? 300 : 0)
  const all = useMemo(() => [...events.values()].filter((e) => e.tabId === tabId).sort((a, b) => a.ts - b.ts), [events, tabId])
  useEffect(() => {
    const h = (e: KeyboardEvent): void => { if (e.key === 'Escape' && useStore.getState().overlay === null) set({ dashboard: false }) }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  }, [set])
  return (
    <div className="dashboard" style={{ top: top + 6 }}>
      <div className="dash-bar">
        <span className="mlabel">{t('dash.title')}</span>
        <button className="icon-btn" aria-label={t('rr.close')} title="Esc" onClick={() => set({ dashboard: false })}><Close /></button>
      </div>
      {tabId ? <Overview events={all} /> : <div className="empty-hint">{t('tabs.none')}</div>}
    </div>
  )
}
