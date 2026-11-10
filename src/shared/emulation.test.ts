import { describe, expect, it } from 'vitest'
import { CPU_RATES, GEO_PRESETS, NETWORK_PRESETS, emuActive, emulationCommands } from './emulation'

describe('emulation', () => {
  it('bos durum her seyi sifirlar', () => {
    const c = Object.fromEntries(emulationCommands(undefined))
    expect(c['Network.emulateNetworkConditions']).toMatchObject({ offline: false, downloadThroughput: -1 })
    expect(c['Emulation.setCPUThrottlingRate']).toEqual({ rate: 1 })
    expect(c['Emulation.clearGeolocationOverride']).toBeDefined()
    expect(c['Emulation.setTimezoneOverride']).toEqual({ timezoneId: '' })
  })
  it('on ayarlar uygulanir', () => {
    const c = Object.fromEntries(emulationCommands({ network: 'slow-3g', cpu: 4, geo: 'tokyo' }))
    expect(c['Network.emulateNetworkConditions']).toMatchObject({ offline: false, latency: 2000 })
    expect(c['Emulation.setCPUThrottlingRate']).toEqual({ rate: 4 })
    expect(c['Emulation.setGeolocationOverride']).toMatchObject({ latitude: 35.6762 })
    expect(c['Emulation.setTimezoneOverride']).toEqual({ timezoneId: 'Asia/Tokyo' })
    expect(c['Emulation.setLocaleOverride']).toEqual({ locale: 'ja-JP' })
    expect(Object.fromEntries(emulationCommands({ network: 'offline' }))['Network.emulateNetworkConditions']).toMatchObject({ offline: true })
  })
  it('emuActive', () => {
    expect(emuActive(undefined)).toBe(false); expect(emuActive({ cpu: 1 })).toBe(false); expect(emuActive({ cpu: 4 })).toBe(true); expect(emuActive({ network: 'offline' })).toBe(true); expect(emuActive({ geo: 'london' })).toBe(true)
  })
  it('kimlikler benzersiz, degerler makul', () => {
    expect(new Set(NETWORK_PRESETS.map((p) => p.id)).size).toBe(NETWORK_PRESETS.length); expect(new Set(GEO_PRESETS.map((p) => p.id)).size).toBe(GEO_PRESETS.length)
    for (const g of GEO_PRESETS) { expect(Math.abs(g.latitude)).toBeLessThanOrEqual(90); expect(Math.abs(g.longitude)).toBeLessThanOrEqual(180) }
    expect(CPU_RATES[0]).toBe(1)
  })
})

import { mediaFeatures, uaPreset, UA_PRESETS, VISION } from './emulation'
describe('genisletilmis emulasyon', () => {
  it('UA onayarlari: mobil olanlar dokunmatigi acar, sifirlama bos UA gonderir', () => {
    const on = Object.fromEntries(emulationCommands({ ua: 'ios-safari' }).map(([m, p]) => [m, p]))
    expect((on['Emulation.setUserAgentOverride'] as any).userAgent).toContain('iPhone'); expect((on['Emulation.setTouchEmulationEnabled'] as any).enabled).toBe(true)
    const off = Object.fromEntries(emulationCommands(undefined).map(([m, p]) => [m, p]))
    expect((off['Emulation.setUserAgentOverride'] as any).userAgent).toBe(''); expect((off['Emulation.setTouchEmulationEnabled'] as any).enabled).toBe(false); expect((off['Emulation.setEmulatedVisionDeficiency'] as any).type).toBe('none')
    expect(uaPreset('nope')).toBeUndefined(); expect(UA_PRESETS.every((u) => u.ua.length > 20)).toBe(true)
  })
  it('gorme bozuklugu yalnizca bilinen tur; dokunmatik ayri acilabilir', () => {
    const cmds = (e: any) => Object.fromEntries(emulationCommands(e).map(([m, p]) => [m, p]))
    expect((cmds({ vision: 'deuteranopia' })['Emulation.setEmulatedVisionDeficiency'] as any).type).toBe('deuteranopia')
    expect((cmds({ vision: 'evil' })['Emulation.setEmulatedVisionDeficiency'] as any).type).toBe('none')
    expect((cmds({ touch: true })['Emulation.setTouchEmulationEnabled'] as any).enabled).toBe(true); expect(VISION).toHaveLength(6)
  })
  it('medya ozellikleri birlesir: renk semasi + hareket + karsitlik + zorunlu renk; yazdirma ortami', () => {
    const m = mediaFeatures({ colorScheme: 'dark', reducedMotion: true }, { contrast: 'more', forcedColors: true, print: true })
    expect(m.features.map((f) => f.name)).toEqual(['prefers-color-scheme', 'prefers-reduced-motion', 'prefers-contrast', 'forced-colors']); expect(m.mediaType).toBe('print')
    expect(mediaFeatures(undefined, undefined)).toEqual({ features: [], mediaType: '' })
  })
  it('emuActive yeni alanlari da sayar', () => { expect(emuActive({ ua: 'googlebot' })).toBe(true); expect(emuActive({ print: true })).toBe(true); expect(emuActive({})).toBe(false) })
})
