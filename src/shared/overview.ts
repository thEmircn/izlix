import type { BusEvent } from './events'
import { buildNetworkRows, typeBreakdown, type NetType } from './network'
import { buildConsoleRows } from './console'
import { aggregateRenders } from './tracker'
import { summarizeVitals, type Vital } from './vitals'
import { sinceNavigation } from './chain'

export interface Overview {
  requests: number; failed: number; bytes: number; p95: number | null; reqSeries: number[]; failSeries: number[]; spanMs: number; types: { type: NetType; bytes: number; count: number; pct: number }[]
  errors: number; warns: number; lastError: string | null
  commits: number; renders: number; hot: { name: string; renders: number; totalMs: number }[]
  vitals: Vital[]; activity: BusEvent[]; healthy: boolean
}

const ACTIVITY = new Set(['input', 'request', 'response', 'render', 'error', 'hmr', 'marker', 'navigation'])

/** Gosterge paneli ozeti: son gezinmeden bu yana ag, konsol, render ve vital sayilari. Saf mantik. */
export function summarizeOverview(all: BusEvent[], buckets = 24): Overview {
  const events = sinceNavigation(all)
  const rows = buildNetworkRows(events).filter((r) => r.type !== 'ws')
  const failed = rows.filter((r) => r.failed || (r.status != null && r.status >= 400)).length
  const bytes = rows.reduce((a, r) => a + (r.size ?? 0), 0)
  const durs = rows.map((r) => r.durationMs).filter((d): d is number => d != null).sort((a, b) => a - b)
  const p95 = durs.length ? durs[Math.min(durs.length - 1, Math.floor(durs.length * 0.95))] : null
  // istek yogunlugu: verinin son 30 sn'lik (en az 3 sn) penceresi
  const tMax = events.length ? events[events.length - 1].ts : 0
  const starts = rows.map((r) => r.start)
  const lo = starts.length ? Math.max(Math.min(...starts), tMax - 30000) : 0
  const span = Math.max(3000, tMax - lo)
  const reqSeries = new Array<number>(buckets).fill(0), failSeries = new Array<number>(buckets).fill(0)
  for (const r of rows) if (r.start >= lo) { const b = Math.min(buckets - 1, Math.floor(((r.start - lo) / span) * buckets)); reqSeries[b]++; if (r.failed || (r.status != null && r.status >= 400)) failSeries[b]++ }
  const con = buildConsoleRows(events)
  const errRows = con.filter((c) => c.level === 'error')
  const renderEvs = events.filter((e) => e.kind === 'render' && e.payload.count > 0)
  const hot = aggregateRenders(events).sort((a, b) => b.totalMs - a.totalMs || b.renders - a.renders).slice(0, 4).map((r) => ({ name: r.name, renders: r.renders, totalMs: r.totalMs }))
  const errors = errRows.reduce((a, c) => a + c.count, 0)
  return {
    requests: rows.length, failed, bytes, p95, reqSeries, failSeries, spanMs: span, types: typeBreakdown(rows),
    errors, warns: con.filter((c) => c.level === 'warn').reduce((a, c) => a + c.count, 0), lastError: errRows.length ? errRows[errRows.length - 1].text.split('\n')[0] : null,
    commits: renderEvs.length, renders: renderEvs.reduce((a, e) => a + (e.payload.count as number), 0), hot,
    vitals: summarizeVitals(events).vitals,
    activity: events.filter((e) => ACTIVITY.has(e.kind) && (e.kind !== 'request' && e.kind !== 'response' ? true : ['Fetch', 'XHR', 'Document'].includes(e.payload.type))).slice(-9).reverse(),
    healthy: errors === 0 && failed === 0
  }
}
