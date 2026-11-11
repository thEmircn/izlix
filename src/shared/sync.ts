import type { Note } from './notes'

/** iCloud Drive esitleme verisi: yalniz yerel, hassas olmayan veriler (sifre ve API anahtarlari ASLA girmez). */
export interface SyncBookmark { url: string; title: string; ts: number; folder?: string }
export interface SyncPayload {
  v: 1
  ts: number
  device: string
  /** Workspace ADI -> yer imleri (kimlikler cihazlar arasi farkli oldugundan) */
  bookmarks: Record<string, SyncBookmark[]>
  notes: Note[]
  sites: Record<string, Record<string, unknown>>
  settings: Record<string, unknown>
}

/** Esitlenen ayar anahtarlari (installId, telemetry, ai, focus gibi cihaza ozel veya hassas olanlar haric) */
export const SYNC_SETTINGS = ['language', 'searchEngine', 'searchSuggest', 'adblock', 'adblockAllow', 'adblockDev', 'ambient', 'ambientDev', 'stripTracking', 'stripTrackingDev', 'cookieBanners', 'httpsOnly', 'spellcheck', 'editor', 'shortcuts', 'apps', 'widgets', 'budgets', 'sleepMinutes'] as const

export function pickSettings(s: Record<string, unknown>): Record<string, unknown> {
  const o: Record<string, unknown> = {}
  for (const k of SYNC_SETTINGS) if (s[k] !== undefined) o[k] = s[k]
  return o
}

/** Birlesim: URL'ye gore tekil; ayni URL'de daha yeni olan kazanir. Yerel sira korunur, yeniler sona eklenir. */
export function mergeBookmarks(local: SyncBookmark[], remote: SyncBookmark[]): SyncBookmark[] {
  const out = local.map((b) => ({ ...b })), idx = new Map(out.map((b, i) => [b.url, i]))
  for (const r of remote) {
    const i = idx.get(r.url)
    if (i === undefined) { idx.set(r.url, out.length); out.push({ ...r }) } else if (r.ts > out[i].ts) out[i] = { ...r }
  }
  return out
}

export function mergeNotes(local: Note[], remote: Note[]): Note[] {
  const by = new Map(local.map((n) => [n.id, n]))
  for (const r of remote) { const l = by.get(r.id); if (!l || r.ts > l.ts) by.set(r.id, r) }
  return [...by.values()]
}

/** Site ayarlari: yerelde olmayan siteler eklenir; olanlar yerelde kalir (yerel tercih silinmez) */
export function mergeSites<T>(local: Record<string, T>, remote: Record<string, T>): Record<string, T> {
  return { ...remote, ...local }
}

export function isPayload(x: unknown): x is SyncPayload {
  const p = x as SyncPayload
  return !!p && p.v === 1 && typeof p.ts === 'number' && typeof p.bookmarks === 'object' && Array.isArray(p.notes) && typeof p.sites === 'object' && typeof p.settings === 'object'
}
