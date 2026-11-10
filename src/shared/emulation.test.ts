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
