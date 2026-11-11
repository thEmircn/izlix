// Baslangic sayfasi parcalari: doviz (TCMB), hava (Open-Meteo), hatirlaticilar (saf ayristirici/yardimcilar).
export interface Rate { code: string; buy: number; sell: number }
/** TCMB today.xml: ForexBuying/ForexSelling (1 birim icin TL); yalniz istenen kodlar */
export function parseTcmb(xml: string, codes = ['USD', 'EUR', 'GBP']): Rate[] {
  const out: Rate[] = []
  for (const m of xml.matchAll(/<Currency\b[^>]*\bKod="([A-Z]{3})"[^>]*>([\s\S]*?)<\/Currency>/g)) {
    if (!codes.includes(m[1])) continue
    const unit = Number(/<Unit>(\d+)<\/Unit>/.exec(m[2])?.[1] ?? 1) || 1
    const buy = Number(/<ForexBuying>([\d.]+)<\/ForexBuying>/.exec(m[2])?.[1]), sell = Number(/<ForexSelling>([\d.]+)<\/ForexSelling>/.exec(m[2])?.[1])
    if (buy > 0 && sell > 0) out.push({ code: m[1], buy: buy / unit, sell: sell / unit })
  }
  return codes.map((c) => out.find((r) => r.code === c)).filter((r): r is Rate => !!r)
}
export interface Weather { name: string; temp: number; code: number; max: number; min: number }
export function parseWeather(name: string, j: any): Weather | null {
  const c = j?.current, d = j?.daily
  if (typeof c?.temperature_2m !== 'number') return null
  return { name, temp: Math.round(c.temperature_2m), code: Number(c.weather_code ?? 0), max: Math.round(d?.temperature_2m_max?.[0] ?? c.temperature_2m), min: Math.round(d?.temperature_2m_min?.[0] ?? c.temperature_2m) }
}
const WMO: Record<number, [string, string]> = { 0: ['Açık', 'Clear'], 1: ['Az bulutlu', 'Mostly clear'], 2: ['Parçalı bulutlu', 'Partly cloudy'], 3: ['Kapalı', 'Overcast'], 45: ['Sisli', 'Fog'], 48: ['Sisli', 'Fog'], 51: ['Çisenti', 'Drizzle'], 53: ['Çisenti', 'Drizzle'], 55: ['Çisenti', 'Drizzle'], 61: ['Yağmur', 'Rain'], 63: ['Yağmur', 'Rain'], 65: ['Şiddetli yağmur', 'Heavy rain'], 71: ['Kar', 'Snow'], 73: ['Kar', 'Snow'], 75: ['Yoğun kar', 'Heavy snow'], 80: ['Sağanak', 'Showers'], 81: ['Sağanak', 'Showers'], 82: ['Şiddetli sağanak', 'Heavy showers'], 95: ['Gök gürültülü', 'Thunderstorm'], 96: ['Dolu', 'Hail'], 99: ['Dolu', 'Hail'] }
export const weatherLabel = (code: number, lang: 'tr' | 'en'): string => (WMO[code] ?? WMO[[0, 1, 2, 3, 45, 51, 61, 71, 80, 95].reduce((b, k) => (Math.abs(k - code) < Math.abs(b - code) ? k : b), 0)])[lang === 'tr' ? 0 : 1]

export interface Reminder { id: string; text: string; due: number; fired?: boolean }
/** Vakti gelmis, henuz bildirilmemis hatirlaticilar */
export const dueReminders = (list: Reminder[], now: number): Reminder[] => list.filter((r) => !r.fired && r.due <= now)
/** "09:30" ya da "yarin 09:30"/"tomorrow 09:30" + serbest metin; yoksa varsayilan: 1 saat sonra. Doner: {due, text} */
export function parseReminder(input: string, now: Date = new Date()): { due: number; text: string } | null {
  let s = input.trim(); if (!s) return null
  let day = 0
  const tm = /^(yarın|yarin|tomorrow)\s+/i.exec(s); if (tm) { day = 1; s = s.slice(tm[0].length) }
  const rel = /^(\d{1,3})\s*(dk|dakika|min|m|sa|saat|h)\s+/i.exec(s)
  if (rel) { const n = Number(rel[1]), unit = rel[2].toLowerCase(); const ms = /^(sa|saat|h)$/.test(unit) ? n * 3_600_000 : n * 60_000; const text = s.slice(rel[0].length).trim(); return text ? { due: now.getTime() + ms, text } : null }
  const m = /^(\d{1,2})[:.](\d{2})\s+/.exec(s)
  if (m) {
    const h = Number(m[1]), mi = Number(m[2]); if (h > 23 || mi > 59) return null
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day, h, mi, 0, 0)
    if (!day && d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1) // bugunun saati gectiyse yarin
    const text = s.slice(m[0].length).trim(); return text ? { due: d.getTime(), text } : null
  }
  return { due: now.getTime() + 3_600_000, text: s }
}
