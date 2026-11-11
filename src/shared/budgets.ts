// Performans butceleri (saf): olcumleri topla, butceyle karsilastir, onceki yuklemeyle kiyasla.
import type { BusEvent } from './events'
import { buildNetworkRows } from './network'
import { summarizeVitals } from './vitals'

export interface Budget { lcp?: number; cls?: number; inp?: number; tbt?: number; requests?: number; transferKB?: number }
export const DEFAULT_BUDGET: Budget = { lcp: 2500, cls: 0.1, inp: 200, tbt: 300 }
export interface Metrics { lcp?: number; cls?: number; inp?: number; tbt?: number; load?: number; requests: number; transferKB: number; ts: number }
export type BudgetKey = keyof Budget
export const BUDGET_KEYS: BudgetKey[] = ['lcp', 'cls', 'inp', 'tbt', 'requests', 'transferKB']

/** Son gezinmeden bu yana olcumler: web vitals + ag (istek sayisi, aktarilan KB) */
export function collectMetrics(events: BusEvent[]): Metrics {
  let from = 0; for (const e of events) if (e.kind === 'navigation' && e.source === 'cdp:Page.frameNavigated') from = e.ts
  const s = summarizeVitals(events), v = (n: string): number | undefined => s.vitals.find((x) => x.name === n)?.value
  const rows = buildNetworkRows(events.filter((e) => e.ts >= from && (e.kind === 'request' || e.kind === 'response' || e.kind === 'error')))
  const bytes = rows.reduce((a, r) => a + (r.size ?? 0), 0)
  return { lcp: v('LCP'), cls: v('CLS'), inp: v('INP'), tbt: s.vitals.length || s.tbt ? s.tbt : undefined, load: s.load ?? undefined, requests: rows.length, transferKB: Math.round(bytes / 1024), ts: Date.now() }
}
export interface Violation { key: BudgetKey; value: number; limit: number }
/** Butceyi asan olcumler (olcum yoksa sayilmaz; sinir 0/undefined ise o metrik denetlenmez) */
export function checkBudgets(m: Metrics, b: Budget): Violation[] {
  const out: Violation[] = []
  for (const k of BUDGET_KEYS) { const limit = b[k], value = m[k]; if (limit && value !== undefined && value > limit) out.push({ key: k, value, limit }) }
  return out
}
export interface Delta { key: BudgetKey | 'load'; prev: number; cur: number; delta: number; better: boolean }
/** Onceki yuklemeyle fark (dusuk daha iyi); yalniz iki tarafta da olan metrikler */
export function compareMetrics(prev: Metrics | undefined, cur: Metrics): Delta[] {
  if (!prev) return []
  const out: Delta[] = []
  for (const k of [...BUDGET_KEYS, 'load'] as (BudgetKey | 'load')[]) { const a = prev[k], b = cur[k]; if (a !== undefined && b !== undefined && a !== b) out.push({ key: k, prev: a, cur: b, delta: b - a, better: b < a }) }
  return out
}
export const unitOf = (k: BudgetKey | 'load'): string => (k === 'cls' ? '' : k === 'requests' ? '' : k === 'transferKB' ? ' KB' : ' ms')
