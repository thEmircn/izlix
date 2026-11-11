// Adres cubugu / yeni sekme onerileri (saf): yerel kaynaklardan (sekme, yer imi, dev sunucusu, gecmis) siralanir. Dis servise istek yok.
import { POPULAR } from './popular'
export type SugKind = 'url' | 'search' | 'tab' | 'bookmark' | 'server' | 'history' | 'site'
export interface Sug { kind: SugKind; title: string; url: string; tabId?: string }
export interface SugSource {
  history: { url: string; title: string; ts: number }[]
  bookmarks: { url: string; title: string }[]
  servers: { port: number; name: string }[]
  tabs: { id: string; url: string; title: string }[]
}

export const looksLikeUrl = (v: string): boolean => /^(https?:\/\/|localhost|[\w-]+(\.[\w-]+)+(\/|:|$)|\d{1,3}(\.\d{1,3}){3})/i.test(v.trim())
const norm = (u: string): string => u.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '').replace(/\/$/, '')
const hostOf = (n: string): string => n.split(/[/?#]/)[0]
const PRIO: Record<SugKind, number> = { tab: 6, bookmark: 5, server: 4, history: 3, site: 2, url: 1, search: 0 }
const BASE: Record<SugKind, number> = { tab: 125, bookmark: 120, server: 120, history: 100, site: -10, url: 0, search: 0 } // kullanici verisi her zaman gomulu sitelerin ustunde

/** Siralanmis oneriler; ilk oge her zaman yazilan metnin kendisi (adres ise git, degilse ara). */
export function suggest(query: string, src: SugSource, limit = 8, now = Date.now()): Sug[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const tokens = q.split(/\s+/)
  const best = new Map<string, { s: Sug; score: number }>()
  const add = (kind: SugKind, url: string, title: string, extra = 0, tabId?: string): void => {
    const n = norm(url), hay = `${n} ${title.toLowerCase()}`
    if (!tokens.every((t) => hay.includes(t))) return
    const host = hostOf(n), tl = title.toLowerCase()
    let score = BASE[kind] + extra
    if (n.startsWith(q)) score += 100; else if (host.startsWith(tokens[0])) score += 80; else if (host.includes(tokens[0])) score += 40
    if (tl.startsWith(q)) score += 30
    score += tokens.length * 5
    const cur = best.get(n)
    if (!cur) best.set(n, { s: { kind, title: title || url, url, ...(tabId ? { tabId } : {}) }, score })
    else { cur.score = Math.max(cur.score, score) + 2; if (PRIO[kind] > PRIO[cur.s.kind]) cur.s = { kind, title: title || cur.s.title, url, ...(tabId ? { tabId } : {}) } }
  }
  for (const t of src.tabs) if (t.url) add('tab', t.url, t.title, 0, t.id)
  for (const b of src.bookmarks) add('bookmark', b.url, b.title)
  for (const d of src.servers) add('server', `http://localhost:${d.port}`, d.name)
  // gomulu populer siteler: yalnizca alan adi ya da ad onekiyle eslesir (gurultuyu onler); kullanici verisi her zaman ustte
  for (const p of POPULAR) { const n = p.name.toLowerCase(); if (norm(p.host).startsWith(tokens[0]) || (tokens.length === 1 && n.startsWith(q)) || (tokens.length > 1 && n.startsWith(q))) add('site', `https://${p.host}`, p.name) }
  for (const h of src.history) add('history', h.url, h.title, 15 * Math.max(0, 1 - (now - h.ts) / (30 * 86_400_000)))
  const list = [...best.values()].sort((a, b) => b.score - a.score).slice(0, limit).map((x) => x.s)
  const first: Sug = looksLikeUrl(query) ? { kind: 'url', title: query.trim(), url: query.trim() } : { kind: 'search', title: query.trim(), url: query.trim() }
  return [first, ...list.filter((x) => norm(x.url) !== norm(first.url))]
}

/** Satir ici tamamlama: yazilan metin bir sitenin host'unun basiysa host'un geri kalani. Bulunamazsa null. */
export function inlineCompletion(query: string, urls: string[]): string | null {
  const q = query.toLowerCase()
  if (!q || /[\s/?#]/.test(q) || /^[a-z]+:\/\//.test(q)) return null
  for (const u of urls) {
    const host = hostOf(norm(u))
    if (host.length > q.length && host.startsWith(q)) return query + host.slice(q.length)
  }
  return null
}
