import { loadDoc, saveDoc } from './docdb'
import { dueReminders, parseTcmb, parseWeather, type Rate, type Reminder, type Weather } from '../shared/widgets'

/** Baslangic sayfasi parcalari: doviz (TCMB, 1 saat onbellek), hava (Open-Meteo, 15 dk), hatirlaticilar (yerel + bildirim). Disari istek yalniz kullanici ilgili parcayi actiysa. */
export class WidgetService {
  private list: Reminder[]
  private ratesCache: { at: number; v: Rate[] } | null = null
  private weatherCache = new Map<string, { at: number; v: Weather | null }>()
  private timer: NodeJS.Timeout | null = null
  constructor(private dir: string, private fetchText: (url: string) => Promise<string | null>, private notify: (r: Reminder) => void, private now: () => number = Date.now) {
    this.list = loadDoc<Reminder[]>(dir, 'reminders') ?? []
    const week = this.now() - 7 * 86_400_000; this.list = this.list.filter((r) => !r.fired || r.due > week)
  }
  private save(): void { try { saveDoc(this.dir, 'reminders', this.list) } catch { /* disk */ } }

  async rates(): Promise<Rate[]> {
    if (this.ratesCache && this.now() - this.ratesCache.at < 3_600_000) return this.ratesCache.v
    const xml = await this.fetchText('https://www.tcmb.gov.tr/kurlar/today.xml')
    const v = xml ? parseTcmb(xml) : []
    if (v.length) this.ratesCache = { at: this.now(), v }
    return v.length ? v : this.ratesCache?.v ?? []
  }
  async weather(city: string): Promise<Weather | null> {
    const key = city.trim().toLowerCase(); if (!key) return null
    const c = this.weatherCache.get(key); if (c && this.now() - c.at < 900_000) return c.v
    const g = await this.fetchText(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city.trim())}&count=1&language=tr`)
    let place: { name: string; latitude: number; longitude: number } | null = null
    try { place = JSON.parse(g ?? '{}').results?.[0] ?? null } catch { /* bozuk yanit */ }
    if (!place) { this.weatherCache.set(key, { at: this.now(), v: null }); return null }
    const f = await this.fetchText(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=1`)
    let v: Weather | null = null; try { v = parseWeather(place.name, JSON.parse(f ?? '{}')) } catch { /* bozuk yanit */ }
    this.weatherCache.set(key, { at: this.now(), v }); return v
  }

  reminders(): Reminder[] { return [...this.list].sort((a, b) => a.due - b.due) }
  add(text: string, due: number): Reminder { const r: Reminder = { id: `r${this.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`, text: text.slice(0, 200), due }; this.list.push(r); this.save(); return r }
  remove(id: string): boolean { const n = this.list.length; this.list = this.list.filter((r) => r.id !== id); if (this.list.length !== n) { this.save(); return true } return false }
  /** Vakti gelenleri bildir (tek sefer); bildirilen sayisi */
  tick(now = this.now()): number {
    const due = dueReminders(this.list, now)
    for (const r of due) { r.fired = true; try { this.notify(r) } catch { /* bildirim hatasi akisi durdurmaz */ } }
    if (due.length) this.save(); return due.length
  }
  start(): void { this.timer ??= setInterval(() => this.tick(), 15_000); this.timer.unref() }
}
