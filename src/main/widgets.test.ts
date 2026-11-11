import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WidgetService } from './widgets'

const XML = '<Currency Kod="USD"><Unit>1</Unit><ForexBuying>50</ForexBuying><ForexSelling>51</ForexSelling></Currency>'
const mk = (fetchText: (u: string) => Promise<string | null>, now = { t: 1_000_000 }) => {
  const notified: string[] = []
  const svc = new WidgetService(mkdtempSync(join(tmpdir(), 'wid-')), fetchText, (r) => notified.push(r.text), () => now.t)
  return { svc, notified, now }
}
describe('WidgetService', () => {
  it('kurlar: ayristirir, 1 saat onbellekler, ag hatasinda eski degeri doner', async () => {
    let calls = 0; let fail = false
    const { svc, now } = mk(async () => { calls++; return fail ? null : XML })
    expect((await svc.rates())[0]).toEqual({ code: 'USD', buy: 50, sell: 51 }); await svc.rates(); expect(calls).toBe(1)
    now.t += 3_700_000; fail = true; expect((await svc.rates())[0].code).toBe('USD') // eski deger
  })
  it('hava: sehir bulunur -> tahmin; sehir yok -> null; onbellek', async () => {
    const urls: string[] = []
    const { svc } = mk(async (u) => { urls.push(u); return u.includes('geocoding') ? (u.includes('Yok') ? '{}' : JSON.stringify({ results: [{ name: 'Ankara', latitude: 39.9, longitude: 32.8 }] })) : JSON.stringify({ current: { temperature_2m: 8.2, weather_code: 3 }, daily: { temperature_2m_max: [11], temperature_2m_min: [4] } }) })
    expect(await svc.weather('Ankara')).toEqual({ name: 'Ankara', temp: 8, code: 3, max: 11, min: 4 }); await svc.weather('ankara'); expect(urls.length).toBe(2)
    expect(await svc.weather('Yok')).toBeNull(); expect(await svc.weather('  ')).toBeNull()
  })
  it('hatirlatici: ekle/sirala/sil; vakti gelen tek sefer bildirilir', () => {
    const { svc, notified, now } = mk(async () => null)
    const a = svc.add('sonra', now.t + 60_000), b = svc.add('once', now.t + 1000)
    expect(svc.reminders().map((r) => r.text)).toEqual(['once', 'sonra'])
    expect(svc.tick(now.t)).toBe(0); expect(svc.tick(now.t + 2000)).toBe(1); expect(svc.tick(now.t + 2000)).toBe(0); expect(notified).toEqual(['once'])
    expect(svc.tick(now.t + 61_000)).toBe(1); expect(svc.remove(a.id)).toBe(true); expect(svc.remove(a.id)).toBe(false); expect(svc.reminders()).toHaveLength(1); void b
  })
})
