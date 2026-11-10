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
  score: number; parts: { net: number; con: number; perf: number | null }
  slowest: { id: number; name: string; method: string; status: number | null; ms: number }[]
  recent: { id: number; text: string; kind: 'console' | 'net' }[]
}

const RATE_PTS = { good: 100, needs: 60, poor: 20 } as const

/** Saglik puani (0-100): ag basarisizligi/gecikme, konsol hatalari ve Web Vitals derecelerinin ortalamasi. */
export function healthScore(requests: number, failed: number, p95: number | null, errors: number, warns: number, vitals: Vital[]): { score: number; parts: { net: number; con: number; perf: number | null } } {
  const net = Math.max(0, Math.round(100 - (requests ? Math.min(100, (failed / requests) * 300) : 0) - (p95 != null ? (p95 > 1000 ? 25 : p95 > 500 ? 10 : 0) : 0)))
  const con = Math.max(0, 100 - Math.min(100, errors * 25 + warns * 5))
  const perf = vitals.length ? Math.round(vitals.reduce((a, v) => a + RATE_PTS[v.rating], 0) / vitals.length) : null
  const list = [net, con, ...(perf != null ? [perf] : [])]
  return { score: Math.round(list.reduce((a, b) => a + b, 0) / list.length), parts: { net, con, perf } }
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
  const warns = con.filter((c) => c.level === 'warn').reduce((a, c) => a + c.count, 0)
  const vitals = summarizeVitals(events).vitals
  const hs = healthScore(rows.length, failed, p95, errors, warns, vitals)
  const slowest = rows.filter((r) => r.durationMs != null).sort((a, b) => (b.durationMs ?? 0) - (a.durationMs ?? 0)).slice(0, 5).map((r) => ({ id: r.id, name: r.name, method: r.method, status: r.status, ms: r.durationMs ?? 0 }))
  const recent = [
    ...errRows.map((c) => ({ ts: c.ts, id: c.id, text: c.text.split('\n')[0], kind: 'console' as const })),
    ...rows.filter((r) => r.failed || (r.status != null && r.status >= 400)).map((r) => ({ ts: r.start, id: r.id, text: `${r.status ?? r.failed} ${r.method} ${r.name}`, kind: 'net' as const }))
  ].sort((a, b) => b.ts - a.ts).slice(0, 4).map(({ id, text, kind }) => ({ id, text, kind }))
  return {
    score: hs.score, parts: hs.parts, slowest, recent,
    requests: rows.length, failed, bytes, p95, reqSeries, failSeries, spanMs: span, types: typeBreakdown(rows),
    errors, warns, lastError: errRows.length ? errRows[errRows.length - 1].text.split('\n')[0] : null,
    commits: renderEvs.length, renders: renderEvs.reduce((a, e) => a + (e.payload.count as number), 0), hot,
    vitals,
    activity: events.filter((e) => ACTIVITY.has(e.kind) && (e.kind !== 'request' && e.kind !== 'response' ? true : ['Fetch', 'XHR', 'Document'].includes(e.payload.type))).slice(-9).reverse(),
    healthy: errors === 0 && failed === 0
  }
}
