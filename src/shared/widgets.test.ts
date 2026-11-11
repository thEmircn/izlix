import { describe, expect, it } from 'vitest'
import { dueReminders, parseReminder, parseTcmb, parseWeather, weatherLabel } from './widgets'
const XML = `<Tarih_Date><Currency Kod="USD" CurrencyCode="USD"><Unit>1</Unit><ForexBuying>50.1078</ForexBuying><ForexSelling>50.1981</ForexSelling></Currency>
<Currency Kod="JPY" CurrencyCode="JPY"><Unit>100</Unit><ForexBuying>30.0</ForexBuying><ForexSelling>31.0</ForexSelling></Currency>
<Currency Kod="EUR" CurrencyCode="EUR"><Unit>1</Unit><ForexBuying>58.5</ForexBuying><ForexSelling>58.7</ForexSelling></Currency></Tarih_Date>`
describe('widgets', () => {
  it('parseTcmb: istenen kodlar, sirayla; birim ile bolunur; eksik kod atlanir', () => {
    expect(parseTcmb(XML)).toEqual([{ code: 'USD', buy: 50.1078, sell: 50.1981 }, { code: 'EUR', buy: 58.5, sell: 58.7 }])
    expect(parseTcmb(XML, ['JPY'])[0]).toEqual({ code: 'JPY', buy: 0.3, sell: 0.31 }); expect(parseTcmb('<x/>')).toEqual([])
  })
  it('parseWeather + weatherLabel (dil, en yakin kod)', () => {
    expect(parseWeather('Istanbul', { current: { temperature_2m: 14.6, weather_code: 61 }, daily: { temperature_2m_max: [17.2], temperature_2m_min: [9.4] } })).toEqual({ name: 'Istanbul', temp: 15, code: 61, max: 17, min: 9 })
    expect(parseWeather('x', {})).toBeNull(); expect(weatherLabel(61, 'tr')).toBe('Yağmur'); expect(weatherLabel(61, 'en')).toBe('Rain'); expect(weatherLabel(62, 'en')).toBe('Rain')
  })
  it('dueReminders', () => { const l = [{ id: 'a', text: 'x', due: 10 }, { id: 'b', text: 'y', due: 99 }, { id: 'c', text: 'z', due: 5, fired: true }]; expect(dueReminders(l, 50).map((r) => r.id)).toEqual(['a']) })
  it('parseReminder: saat, yarin, goreli sure, varsayilan', () => {
    const now = new Date(2026, 10, 11, 10, 0, 0)
    expect(new Date(parseReminder('14:30 toplanti', now)!.due)).toEqual(new Date(2026, 10, 11, 14, 30)); expect(parseReminder('14:30 toplanti', now)!.text).toBe('toplanti')
    expect(new Date(parseReminder('09:00 ilac', now)!.due)).toEqual(new Date(2026, 10, 12, 9, 0)) // gecmis saat -> yarin
    expect(new Date(parseReminder('yarın 08:15 spor', now)!.due)).toEqual(new Date(2026, 10, 12, 8, 15))
    expect(parseReminder('30 dk cay', now)!.due).toBe(now.getTime() + 30 * 60000); expect(parseReminder('2 sa ara', now)!.due).toBe(now.getTime() + 2 * 3600000)
    expect(parseReminder('su al', now)!.due).toBe(now.getTime() + 3600000); expect(parseReminder('  ', now)).toBeNull(); expect(parseReminder('25:00 x', now)).toBeNull()
  })
})
