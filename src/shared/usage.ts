// Site kullanim suresi ve odak modu (saf).
import { siteOf } from './adblock'
export type Usage = Record<string, Record<string, number>> // gun -> site -> saniye
export interface FocusCfg { on: boolean; /** engellenen siteler (ana alan adi: example.com) */ sites: string[]; /** site -> gunluk limit (dakika) */ limits: Record<string, number>; /** site -> izin bitis zamani (epoch ms) */ snooze?: Record<string, number> }
export const dayKey = (d: Date = new Date()): string => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

export function addSeconds(u: Usage, site: string, sec: number, day: string): void { const d = (u[day] ??= {}); d[site] = (d[site] ?? 0) + sec }
/** Son `keep` gunden eskisini siler */
export function prune(u: Usage, keep: number, today: Date = new Date()): void {
  const min = dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - keep + 1))
  for (const k of Object.keys(u)) if (k < min) delete u[k]
}
export function topSites(u: Usage, days: string[], limit = 12): { site: string; sec: number }[] {
  const m = new Map<string, number>(); for (const d of days) for (const [s, v] of Object.entries(u[d] ?? {})) m.set(s, (m.get(s) ?? 0) + v)
  return [...m.entries()].map(([site, sec]) => ({ site, sec })).sort((a, b) => b.sec - a.sec).slice(0, limit)
}
export const totalSec = (u: Usage, day: string): number => Object.values(u[day] ?? {}).reduce((a, b) => a + b, 0)
/** Son n gun (bugun dahil) anahtarlari, eskiden yeniye */
export function lastDays(n: number, today: Date = new Date()): string[] { return Array.from({ length: n }, (_, i) => dayKey(new Date(today.getFullYear(), today.getMonth(), today.getDate() - (n - 1 - i)))) }
/** "site dakika" satirlarini limit tablosuna cevirir */
export function parseLimits(text: string): Record<string, number> {
  const o: Record<string, number> = {}
  for (const line of text.split('\n')) { const m = /^\s*([a-z0-9.-]+\.[a-z]{2,})\s+(\d{1,4})\s*$/i.exec(line); if (m && Number(m[2]) > 0) o[siteOf(m[1].toLowerCase())] = Number(m[2]) }
  return o
}
export const siteList = (text: string): string[] => [...new Set(text.split(/[\s,]+/).map((s) => s.trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/.*$/, '')).filter((s) => /^[a-z0-9.-]+\.[a-z]{2,}$/.test(s)).map(siteOf))]

/** Adres engelli mi: 'focus' (odak modu listesi), 'limit' (gunluk limit doldu) ya da null. Loopback ve izinli (snooze) siteler gecer. */
export function blockReason(url: string, cfg: FocusCfg | undefined, usedToday: (site: string) => number, now = Date.now()): { reason: 'focus' | 'limit'; site: string } | null {
  if (!cfg) return null
  let host = ''; try { const u = new URL(url); if (u.protocol !== 'http:' && u.protocol !== 'https:') return null; host = u.hostname.toLowerCase() } catch { return null }
  if (host === 'localhost' || host === '127.0.0.1' || host.endsWith('.localhost') || !host.includes('.')) return null
  const site = siteOf(host)
  if ((cfg.snooze?.[site] ?? 0) > now) return null
  if (cfg.on && cfg.sites.some((s) => siteOf(s) === site)) return { reason: 'focus', site }
  const lim = cfg.limits[site]; if (lim && usedToday(site) >= lim * 60) return { reason: 'limit', site }
  return null
}
