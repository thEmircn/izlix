import type { BusEvent } from './events'

export type NetType = 'doc' | 'css' | 'js' | 'img' | 'font' | 'xhr' | 'ws' | 'other'

export interface NetRow {
  id: number            // istek olayinin kimligi
  requestId: string
  method: string
  url: string
  name: string          // yolun son parcasi
  host: string
  type: NetType
  status: number | null // null: bekliyor
  failed: string | null
  mime: string
  size: number | null
  start: number
  end: number | null
  durationMs: number | null
  modified: boolean
  resId: number | null
  fromCache: boolean
  /** WebSocket: mesaj sayisi ve kapandi mi */
  frames: number
  closed: boolean
}

const TYPE_MAP: Record<string, NetType> = { Document: 'doc', Stylesheet: 'css', Script: 'js', Image: 'img', Font: 'font', XHR: 'xhr', Fetch: 'xhr', Other: 'other', Media: 'img', Manifest: 'other', WebSocket: 'ws', Ping: 'xhr', Preflight: 'xhr' }
export const typeOf = (t: string | undefined): NetType => TYPE_MAP[t ?? ''] ?? 'other'

export function nameOf(url: string): string {
  try { const u = new URL(url); const last = u.pathname.split('/').filter(Boolean).pop(); return (last ?? u.host) + (u.search ? u.search.slice(0, 24) : '') } catch { return url.slice(0, 40) }
}

/** istek + yanit + hata olaylarini tek bir satira birlestirir (requestId ile). Zamana gore siralidir. */
export function buildNetworkRows(events: Iterable<BusEvent>): NetRow[] {
  const rows = new Map<string, NetRow>()
  const order: string[] = []
  for (const e of events) {
    const p = e.payload
    if (e.kind === 'request' && p.requestId) {
      let host = ''
      try { host = new URL(p.url).host } catch { /* ham url */ }
      rows.set(p.requestId, {
        id: e.id, requestId: p.requestId, method: p.method, url: p.url, name: nameOf(p.url), host, type: typeOf(p.type), status: null, failed: null, mime: '', size: null,
        start: e.ts, end: null, durationMs: null, modified: !!p.modified, resId: null, fromCache: false, frames: 0, closed: false
      })
      order.push(p.requestId)
    } else if (e.kind === 'response' && rows.has(p.requestId)) {
      const r = rows.get(p.requestId)!
      r.status = p.status; r.mime = p.mimeType ?? ''; r.resId = e.id; r.fromCache = !!p.fromCache
      r.end = typeof p.finishedTs === 'number' ? p.finishedTs : e.ts
      if (typeof p.size === 'number') r.size = p.size
    } else if (e.kind === 'ws' && rows.has(p.requestId)) {
      const r = rows.get(p.requestId)!
      if (p.dir === 'closed') { r.closed = true; r.end = e.ts } else if (p.dir === 'sent' || p.dir === 'recv') r.frames++
    } else if (e.kind === 'error' && p.requestId && rows.has(p.requestId)) {
      const r = rows.get(p.requestId)!
      r.failed = String(p.errorText ?? 'failed'); r.end = e.ts
    }
  }
  const out = order.map((k) => rows.get(k)!)
  for (const r of out) { if (r.end != null) r.durationMs = Math.max(0, Math.round(r.end - r.start)) }
  // istek olayi `modified` rozetini sonradan alabilir: son durumu yansit
  return out
}

export const formatBytes = (n: number | null): string => n == null ? '' : n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(n < 10240 ? 1 : 0)} kB` : `${(n / 1048576).toFixed(1)} MB`
export const formatMs = (n: number | null): string => n == null ? '' : n < 1000 ? `${n} ms` : `${(n / 1000).toFixed(2)} s`
export const statusClass = (r: Pick<NetRow, 'status' | 'failed'>): 'pending' | 'ok' | 'redirect' | 'client' | 'server' | 'failed' =>
  r.failed ? 'failed' : r.status == null ? 'pending' : r.status >= 500 ? 'server' : r.status >= 400 ? 'client' : r.status >= 300 ? 'redirect' : 'ok'

const shq = (v: string): string => `'${v.replace(/'/g, `'\\''`)}'`
const SKIP_HEADERS = /^(host|content-length|connection|accept-encoding|sec-.*|:.*|origin|referer|user-agent|cookie)$/i

/** Istegi cURL komutuna cevirir (gorunur basliklarla; cerez ve tarayiciya ozgu basliklar atlanir). */
export function toCurl(method: string, url: string, headers: Record<string, string> = {}, body?: string): string {
  const parts = [`curl ${shq(url)}`]
  if (method !== 'GET') parts.push(`-X ${method}`)
  for (const [k, v] of Object.entries(headers)) if (!SKIP_HEADERS.test(k)) parts.push(`-H ${shq(`${k}: ${v}`)}`)
  if (body) parts.push(`--data-raw ${shq(body)}`)
  return parts.join(' \\\n  ')
}

/** Istegi fetch() cagrisina cevirir */
export function toFetch(method: string, url: string, headers: Record<string, string> = {}, body?: string): string {
  const h = Object.fromEntries(Object.entries(headers).filter(([k]) => !SKIP_HEADERS.test(k)))
  const init: Record<string, unknown> = { method }
  if (Object.keys(h).length) init.headers = h
  if (body) init.body = body
  return `fetch(${JSON.stringify(url)}, ${JSON.stringify(init, null, 2)})`
}

/** Istegi sayfa baglaminda yeniden gonderen ifade (cerezler sayfanin oturumundan gelir). Basliklar toFetch ile ayni suzgecten gecer. */
export function replayExpression(method: string, url: string, headers: Record<string, string> = {}, body?: string): string {
  const h = Object.fromEntries(Object.entries(headers).filter(([k]) => !SKIP_HEADERS.test(k)))
  const init: Record<string, unknown> = { method, headers: h, credentials: 'include' }
  if (body && !/^(GET|HEAD)$/i.test(method)) init.body = body
  return `await fetch(${JSON.stringify(url)}, ${JSON.stringify(init)}).then((r) => r.status + ' ' + r.statusText)` // REPL kipi: ust duzey await
}

/** Tur bazinda aktarilan bayt (buyukten kucuge) ve toplam */
export function typeBreakdown(rows: Pick<NetRow, 'type' | 'size'>[]): { type: NetType; bytes: number; count: number; pct: number }[] {
  const m = new Map<NetType, { bytes: number; count: number }>()
  for (const r of rows) { const e = m.get(r.type) ?? { bytes: 0, count: 0 }; e.bytes += r.size ?? 0; e.count++; m.set(r.type, e) }
  const total = [...m.values()].reduce((a, b) => a + b.bytes, 0)
  return [...m.entries()].map(([type, v]) => ({ type, bytes: v.bytes, count: v.count, pct: total ? (v.bytes / total) * 100 : 0 })).sort((a, b) => b.bytes - a.bytes)
}

export type SortKey = 'time' | 'name' | 'status' | 'size' | 'duration'
/** Sutun siralamasi: 'time' = istek sirasi (varsayilan, artan). Bekleyenler sona. Kararli. */
export function sortRows<T extends Pick<NetRow, 'start' | 'name' | 'status' | 'size' | 'durationMs'>>(rows: T[], key: SortKey, dir: 'asc' | 'desc'): T[] {
  const val = (r: T): number | string | null => key === 'time' ? r.start : key === 'name' ? r.name.toLowerCase() : key === 'status' ? r.status : key === 'size' ? r.size : r.durationMs
  const m = dir === 'asc' ? 1 : -1
  return rows.map((r, i) => ({ r, i, v: val(r) })).sort((a, b) => {
    if (a.v === null && b.v === null) return a.i - b.i
    if (a.v === null) return 1
    if (b.v === null) return -1
    return (a.v < b.v ? -1 : a.v > b.v ? 1 : 0) * m || a.i - b.i
  }).map((x) => x.r)
}
