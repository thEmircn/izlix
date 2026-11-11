import { useEffect, useMemo, useRef } from 'react'
import type { BusEvent } from '../shared/events'
import { useState } from 'react'
import { BUDGET_KEYS, checkBudgets, collectMetrics, compareMetrics, DEFAULT_BUDGET, unitOf, type Metrics } from '../shared/budgets'
import { pageKey } from '../shared/notes'
import { useStore, useT, useThrottled } from './store'

/** Arac cubugu rozeti: butceyi asan olcum varsa sayisi; sayfa yuklenince olcumleri sayfa gecmisine kaydeder. */
export function BudgetChip() {
  const t = useT()
  const events = useThrottled(useStore((s) => s.events), 1500)
  const tabId = useStore((s) => s.activeTabId), url = useStore((s) => s.tabs.find((x) => x.id === s.activeTabId)?.url ?? ''), budgets = useStore((s) => s.settings.budgets)
  const budget = useMemo(() => ({ ...DEFAULT_BUDGET, ...(budgets ?? {}) }), [budgets])
  const metrics = useMemo(() => collectMetrics([...events.values()].filter((e) => e.tabId === tabId)), [events, tabId])
  const viol = useMemo(() => checkBudgets(metrics, budget), [metrics, budget])
  // yuklenme tamamlandiktan 2,5 sn sonra bir kez kaydet (ayni yuklemeyi tekrar kaydetme)
  const saved = useRef('')
  useEffect(() => {
    const key = pageKey(url); if (!key || metrics.load === undefined) return
    const sig = `${tabId}|${key}|${Math.round(metrics.load)}`
    if (saved.current === sig) return
    const h = setTimeout(() => { saved.current = sig; void window.izlix.perfSave(key, { ...metrics, ts: Date.now() }) }, 2500)
    return () => clearTimeout(h)
  }, [metrics.load, url, tabId])
  if (!viol.length) return null
  return <button type="button" className="chip budgetchip nodrag" title={viol.map((v) => `${v.key.toUpperCase()} ${v.value}${unitOf(v.key)} > ${v.limit}${unitOf(v.key)}`).join('\n')} onClick={() => useStore.getState().set({ panelTab: 'perf' as never, panelOpen: true, dashboard: false })}>{t('budget.chip', { n: viol.length })}</button>
}

/** Performance panelinde: butce durumu (gecti/asti) ve son iki yukleme arasindaki fark. */
export function BudgetPanel({ events }: { events: BusEvent[] }) {
  const t = useT()
  const url = useStore((s) => s.tabs.find((x) => x.id === s.activeTabId)?.url ?? ''), budgets = useStore((s) => s.settings.budgets)
  const budget = { ...DEFAULT_BUDGET, ...(budgets ?? {}) }
  const m = collectMetrics(events)
  const viol = checkBudgets(m, budget)
  const [hist, setHist] = useState<Metrics[]>([])
  useEffect(() => { const k = pageKey(url); if (k) void window.izlix.perfHistory(k).then((l: Metrics[]) => setHist(l ?? [])); else setHist([]) }, [url, m.load])
  const deltas = compareMetrics(hist.length >= 2 ? hist[hist.length - 2] : undefined, hist[hist.length - 1] ?? m)
  const fmtv = (k: string, v: number): string => (k === 'cls' ? v.toFixed(3) : String(Math.round(v)))
  return (
    <div className="budget">
      <h4 className="sec">{t('budget.title')}</h4>
      <div className="budget-grid">
        {BUDGET_KEYS.filter((k) => budget[k]).map((k) => {
          const v = m[k]; const bad = viol.some((x) => x.key === k)
          return <div key={k} className={`bcell ${v === undefined ? 'na' : bad ? 'bad' : 'ok'}`}><span>{t(`budget.${k}` as any)}</span><b>{v === undefined ? '—' : `${fmtv(k, v)}${unitOf(k)}`}</b><small>{t('budget.limit')} {fmtv(k, budget[k]!)}{unitOf(k)}</small><i>{v === undefined ? '' : bad ? '✗' : '✓'}</i></div>
        })}
      </div>
      {deltas.length > 0 && <div className="budget-delta"><span>{t('budget.vsPrev')}:</span>{deltas.map((d) => <em key={d.key} className={d.better ? 'good' : 'worse'}>{d.key.toUpperCase()} {d.delta > 0 ? '+' : ''}{fmtv(d.key, d.delta)}{unitOf(d.key)}</em>)}</div>}
    </div>
  )
}
