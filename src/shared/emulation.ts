// Aglari/CPU'yu kisitlama ve konum/saat dilimi/dil emulasyonu on ayarlari (saf veri).
export interface NetPreset { id: string; label: string; offline: boolean; latency: number; down: number; up: number }
// down/up bayt/sn; latency ms (Chrome DevTools degerleriyle ayni)
export const NETWORK_PRESETS: NetPreset[] = [
  { id: 'offline', label: 'Offline', offline: true, latency: 0, down: 0, up: 0 },
  { id: 'slow-3g', label: 'Slow 3G', offline: false, latency: 2000, down: (500 * 1024) / 8, up: (500 * 1024) / 8 },
  { id: 'fast-3g', label: 'Fast 3G', offline: false, latency: 562.5, down: (1.6 * 1024 * 1024) / 8 * 0.9, up: (750 * 1024) / 8 * 0.9 },
  { id: 'regular-4g', label: '4G', offline: false, latency: 170, down: (9 * 1024 * 1024) / 8, up: (9 * 1024 * 1024) / 8 }
]
export const CPU_RATES = [1, 2, 4, 6] as const

export interface GeoPreset { id: string; label: string; latitude: number; longitude: number; timezone: string; locale: string }
export const GEO_PRESETS: GeoPreset[] = [
  { id: 'istanbul', label: 'Istanbul', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul', locale: 'tr-TR' },
  { id: 'new-york', label: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', locale: 'en-US' },
  { id: 'london', label: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', locale: 'en-GB' },
  { id: 'berlin', label: 'Berlin', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin', locale: 'de-DE' },
  { id: 'tokyo', label: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', locale: 'ja-JP' },
  { id: 'sao-paulo', label: 'Sao Paulo', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo', locale: 'pt-BR' }
]

export interface Emu { network?: string; cpu?: number; geo?: string }
export const networkPreset = (id: string | undefined): NetPreset | undefined => NETWORK_PRESETS.find((p) => p.id === id)
export const geoPreset = (id: string | undefined): GeoPreset | undefined => GEO_PRESETS.find((p) => p.id === id)
export const emuActive = (e: Emu | undefined): boolean => !!e && (!!e.network || (e.cpu ?? 1) > 1 || !!e.geo)

/** CDP komut listesi: verilen emulasyon durumu icin sirasiyla gonderilecek (yontem, parametre) ciftleri. Bos durum = hepsini sifirla. */
export function emulationCommands(e: Emu | undefined): [string, Record<string, unknown>][] {
  const n = networkPreset(e?.network)
  const g = geoPreset(e?.geo)
  return [
    ['Network.emulateNetworkConditions', n ? { offline: n.offline, latency: n.latency, downloadThroughput: n.offline ? 0 : n.down, uploadThroughput: n.offline ? 0 : n.up } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }],
    ['Emulation.setCPUThrottlingRate', { rate: Math.max(1, e?.cpu ?? 1) }],
    g ? ['Emulation.setGeolocationOverride', { latitude: g.latitude, longitude: g.longitude, accuracy: 25 }] : ['Emulation.clearGeolocationOverride', {}],
    ['Emulation.setTimezoneOverride', { timezoneId: g?.timezone ?? '' }],
    ['Emulation.setLocaleOverride', { locale: g?.locale ?? '' }]
  ]
}
