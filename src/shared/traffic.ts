import type { NetRow } from './network'
import type { BusEvent } from './events'

export interface Bins { reqs: number[]; bytes: number[]; fails: number[]; binMs: number; startT: number }

/** Son windowMs icindeki ag etkinligini binMs'lik kovalara boler (kova i: [startT + i*binMs, +binMs)). Saf mantik. */
export function binTraffic(rows: NetRow[], now: number, windowMs = 60_000, binMs = 500): Bins {
  const n = Math.ceil(windowMs / binMs) + 1
  const startT = now - windowMs
  const reqs = new Array<number>(n).fill(0), bytes = new Array<number>(n).fill(0), fails = new Array<number>(n).fill(0)
  const at = (t: number): number => Math.floor((t - startT) / binMs)
  for (const r of rows) {
    if (r.type === 'ws') continue
    const i = at(r.start)
    if (i >= 0 && i < n) { reqs[i]++; if (r.failed || (r.status != null && r.status >= 400)) fails[i]++ }
    if (r.size) { const j = at(r.end ?? r.start); if (j >= 0 && j < n) bytes[j] += r.size }
  }
  return { reqs, bytes, fails, binMs, startT }
}

/** Basit agirlikli komsu ortalamasi: grafigin akici gorunmesi icin. */
export function smooth(v: number[], kernel = [1, 2, 3, 2, 1]): number[] {
  const h = Math.floor(kernel.length / 2), sum = kernel.reduce((a, b) => a + b, 0)
  return v.map((_, i) => { let a = 0; for (let k = -h; k <= h; k++) a += (v[i + k] ?? 0) * kernel[k + h]; return a / sum })
}

/** Son secondsAgo saniyedeki ortalama hiz (saniye basina). */
export function rate(b: Bins, arr: number[], seconds: number): number {
  const k = Math.ceil((seconds * 1000) / b.binMs)
  let s = 0; for (let i = Math.max(0, arr.length - 1 - k); i < arr.length - 1; i++) s += arr[i]
  return s / seconds
}

const ACTIVITY_KINDS = new Set(['input', 'request', 'response', 'render', 'console', 'error', 'hmr', 'navigation'])
/** Timeline icin: tum olaylarin yogunlugu. reqs = olay sayisi, bytes = render (commit) sayisi, fails = hata olaylari. */
export function binEvents(events: BusEvent[], now: number, windowMs = 60_000, binMs = 500): Bins {
  const n = Math.ceil(windowMs / binMs) + 1, startT = now - windowMs
  const reqs = new Array<number>(n).fill(0), bytes = new Array<number>(n).fill(0), fails = new Array<number>(n).fill(0)
  for (let k = events.length - 1; k >= 0; k--) {
    const e = events[k]; if (e.ts < startT) break
    if (!ACTIVITY_KINDS.has(e.kind)) continue
    const i = Math.floor((e.ts - startT) / binMs); if (i < 0 || i >= n) continue
    reqs[i]++
    if (e.kind === 'render' && e.payload.count > 0) bytes[i]++
    if (e.kind === 'error' || (e.kind === 'console' && e.payload.level === 'error')) fails[i]++
  }
  return { reqs, bytes, fails, binMs, startT }
}
