import type { BusEvent } from './events'

export type NetType = 'doc' | 'css' | 'js' | 'img' | 'font' | 'xhr' | 'other'

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
}

const TYPE_MAP: Record<string, NetType> = { Document: 'doc', Stylesheet: 'css', Script: 'js', Image: 'img', Font: 'font', XHR: 'xhr', Fetch: 'xhr', Other: 'other', Media: 'img', Manifest: 'other', WebSocket: 'other', Ping: 'xhr', Preflight: 'xhr' }
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
        start: e.ts, end: null, durationMs: null, modified: !!p.modified, resId: null, fromCache: false
      })
      order.push(p.requestId)
    } else if (e.kind === 'response' && rows.has(p.requestId)) {
      const r = rows.get(p.requestId)!
      r.status = p.status; r.mime = p.mimeType ?? ''; r.resId = e.id; r.fromCache = !!p.fromCache
      r.end = typeof p.finishedTs === 'number' ? p.finishedTs : e.ts
      if (typeof p.size === 'number') r.size = p.size
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
