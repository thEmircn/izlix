import type { BusEvent, Certainty } from '../shared/events'

export type BusListener = (e: BusEvent, change: 'new' | 'update') => void

const MAX_EVENTS = 50_000
const MAX_AGE_MS = 15 * 60 * 1000
/** Bundan eski render olaylarinin bilesen ayrintisi kirpilir (bellek: yogun render trafiginde 15 dk tampon cok sisebilir) */
export const COMPACT_AGE_MS = 60 * 1000
export const COMPACT_KEEP = 12

/** Sekme basina halka tampon: son 15 dk veya 50.000 olay, hangisi once dolarsa. */
export class EventBus {
  private nextId = 1
  private buffers = new Map<string, BusEvent[]>()
  private byId = new Map<number, BusEvent>()
  private listeners = new Set<BusListener>()

  constructor(private now: () => number = Date.now) {}

  emit(e: Pick<BusEvent, 'tabId' | 'kind' | 'source' | 'payload'> & { ts?: number }): BusEvent {
    const ev: BusEvent = { id: this.nextId++, tabId: e.tabId, ts: e.ts ?? this.now(), kind: e.kind, source: e.source, payload: e.payload, causeIds: [], links: [] }
    const buf = this.buffers.get(ev.tabId) ?? []
    buf.push(ev)
    this.byId.set(ev.id, ev)
    const newest = this.now()
    while (buf.length > MAX_EVENTS || (buf.length && newest - buf[0].ts > MAX_AGE_MS)) this.byId.delete(buf.shift()!.id)
    this.buffers.set(ev.tabId, buf)
    this.listeners.forEach((l) => l(ev, 'new'))
    return ev
  }

  get(id: number): BusEvent | undefined { return this.byId.get(id) }

  /** effect olayina bir neden bagi ekler (kesin / tahmini isaretli) */
  link(effectId: number, causeId: number, certainty: Certainty, type: string): void {
    const ev = this.byId.get(effectId)
    if (!ev || !this.byId.has(causeId) || ev.causeIds.includes(causeId)) return
    ev.causeIds.push(causeId)
    ev.links.push({ from: causeId, certainty, type })
    this.listeners.forEach((l) => l(ev, 'update'))
  }

  /** payload'a sonradan alan ekler (orn. kaynak konumu cozumlenince) */
  patch(id: number, payload: Record<string, any>): void {
    const ev = this.byId.get(id)
    if (!ev) return
    Object.assign(ev.payload, payload)
    this.listeners.forEach((l) => l(ev, 'update'))
  }

  /**
   * Eski render olaylarinin `components` listesini en yavas COMPACT_KEEP bilesene indirir (sayilar ve toplamlar korunur;
   * `compacted` alani orijinal sayiyi tutar). Raporlar ve Timeline icin yeterli, bellek ~10x daha az.
   */
  compact(): number {
    const cutoff = this.now() - COMPACT_AGE_MS
    let n = 0
    for (const buf of this.buffers.values()) {
      for (const e of buf) {
        if (e.ts >= cutoff) break // tampon zamana gore siralidir
        const c = e.payload.components
        if (e.kind !== 'render' || !Array.isArray(c) || c.length <= COMPACT_KEEP || e.payload.compacted) continue
        e.payload.compacted = c.length
        e.payload.components = [...c].sort((a: any, b: any) => (b.ms ?? 0) - (a.ms ?? 0)).slice(0, COMPACT_KEEP)
        n++
      }
    }
    return n
  }

  snapshot(tabId: string): BusEvent[] { return this.buffers.get(tabId) ?? [] }
  dropTab(tabId: string): void {
    for (const e of this.buffers.get(tabId) ?? []) this.byId.delete(e.id)
    this.buffers.delete(tabId)
  }

  subscribe(fn: BusListener): () => void {
    this.listeners.add(fn)
    return () => this.listeners.delete(fn)
  }
}
