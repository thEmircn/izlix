import { describe, expect, it } from 'vitest'
import { keys, translate } from './i18n'

describe('i18n', () => {
  it('her anahtarin Turkce cevirisi var ve bos degil', () => {
    for (const k of keys) { expect(translate('tr', k).length).toBeGreaterThan(0); expect(translate('en', k).length).toBeGreaterThan(0) }
  })
  it('yer tutucular iki dilde de ayni isimleri kullanir', () => {
    const ph = (s: string): string[] => (s.match(/\{\w+\}/g) ?? []).sort()
    for (const k of keys) expect(ph(translate('tr', k))).toEqual(ph(translate('en', k)))
  })
  it('yer tutucu doldurulur; eksik degisken oldugu gibi kalir', () => {
    expect(translate('en', 'rules.badge', { n: 3 })).toBe('Rules: 3')
    expect(translate('en', 'rules.badge')).toBe('Rules: {n}')
  })
})
