import type { BusEvent } from './events'

export type Rating = 'good' | 'needs' | 'poor'
export interface Vital { name: string; value: number; rating: Rating; unit: 'ms' | '' ; detail?: string; max: number }

const T: Record<string, [number, number, number]> = { // iyi siniri, kotu siniri, gosterge tavani
  FCP: [1800, 3000, 4000], LCP: [2500, 4000, 5000], CLS: [0.1, 0.25, 0.4], INP: [200, 500, 700], TTFB: [800, 1800, 2400]
}
export const rate = (name: string, v: number): Rating => { const t = T[name]; if (!t) return 'good'; return v <= t[0] ? 'good' : v <= t[1] ? 'needs' : 'poor' }

export interface PerfSummary { vitals: Vital[]; longTasks: { start: number; ms: number }[]; tbt: number; dcl: number | null; load: number | null; shifts: number }

/** Son gezinmeden bu yana olan 'vital' olaylarindan ozet (son deger kazanir). */
export function summarizeVitals(events: BusEvent[]): PerfSummary {
  let from = 0
  for (const e of events) if (e.kind === 'navigation' && e.source === 'cdp:Page.frameNavigated') from = e.ts
  const last: Record<string, BusEvent> = {}
  const longTasks: PerfSummary['longTasks'] = []
  let shifts = 0
  for (const e of events) {
    if (e.kind !== 'vital' || e.ts < from) continue
    const n = e.payload.name as string
    if (n === 'longtask') longTasks.push({ start: e.payload.start ?? 0, ms: e.payload.value })
    else { last[n] = e; if (n === 'CLS') shifts++ }
  }
  const vitals: Vital[] = []
  for (const n of ['TTFB', 'FCP', 'LCP', 'CLS', 'INP']) {
    const e = last[n]; if (!e) continue
    const v = e.payload.value as number
    vitals.push({ name: n, value: v, rating: rate(n, v), unit: n === 'CLS' ? '' : 'ms', max: T[n][2], detail: n === 'LCP' && e.payload.el ? `<${e.payload.el}>` : n === 'INP' && e.payload.event ? String(e.payload.event) : undefined })
  }
  const tbt = Math.round(longTasks.reduce((a, t) => a + Math.max(0, t.ms - 50), 0))
  return { vitals, longTasks, tbt, dcl: last.DCL?.payload.value ?? null, load: last.Load?.payload.value ?? null, shifts }
}
