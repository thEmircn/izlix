import type { BusEvent } from '../shared/events'

export interface TrackerRow {
  key: string; name: string; renders: number; totalMs: number; maxMs: number
  reasons: Record<string, number>; lastReason: string; changedProps: string[]; changedHooks: number[]
  file?: string; line?: number; column?: number; lastTs: number
}

/** Render Tracker: commit olaylarindan bilesen basina render sayisi, sure ve neden dagilimi. */
export function aggregateRenders(events: BusEvent[], range?: [number, number]): TrackerRow[] {
  const rows = new Map<string, TrackerRow>()
  for (const e of events) {
    if (e.kind !== 'render' || (range && (e.ts < range[0] || e.ts > range[1]))) continue
    for (const c of e.payload.components ?? []) {
      const key = c.t != null ? `t${c.t}` : `n:${c.name}`
      let r = rows.get(key)
      if (!r) { r = { key, name: c.name, renders: 0, totalMs: 0, maxMs: 0, reasons: {}, lastReason: '', changedProps: [], changedHooks: [], lastTs: 0 }; rows.set(key, r) }
      r.renders++
      const ms = typeof c.ms === 'number' ? c.ms : 0
      r.totalMs += ms; r.maxMs = Math.max(r.maxMs, ms)
      r.reasons[c.reason] = (r.reasons[c.reason] ?? 0) + 1
      if (e.ts >= r.lastTs) { r.lastTs = e.ts; r.lastReason = c.reason }
      for (const p of c.props ?? []) if (!r.changedProps.includes(p)) r.changedProps.push(p)
      for (const h of c.hooks ?? []) if (!r.changedHooks.includes(h.index)) r.changedHooks.push(h.index)
      if (c.file && !r.file) { r.file = c.file; r.line = c.line; r.column = c.column }
    }
  }
  return [...rows.values()].sort((a, b) => b.renders - a.renders || b.totalMs - a.totalMs)
}

/** "Gereksiz render" ipucu: yalnizca ust bilesen yuzunden (props/state degismeden) render olanlar. */
export const wastedRatio = (r: TrackerRow): number => (r.renders ? (r.reasons.parent ?? 0) / r.renders : 0)
