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
  { id: 'istanbul', label: 'İstanbul', latitude: 41.0082, longitude: 28.9784, timezone: 'Europe/Istanbul', locale: 'tr-TR' },
  { id: 'new-york', label: 'New York', latitude: 40.7128, longitude: -74.006, timezone: 'America/New_York', locale: 'en-US' },
  { id: 'london', label: 'London', latitude: 51.5074, longitude: -0.1278, timezone: 'Europe/London', locale: 'en-GB' },
  { id: 'berlin', label: 'Berlin', latitude: 52.52, longitude: 13.405, timezone: 'Europe/Berlin', locale: 'de-DE' },
  { id: 'tokyo', label: 'Tokyo', latitude: 35.6762, longitude: 139.6503, timezone: 'Asia/Tokyo', locale: 'ja-JP' },
  { id: 'sao-paulo', label: 'Sao Paulo', latitude: -23.5505, longitude: -46.6333, timezone: 'America/Sao_Paulo', locale: 'pt-BR' }
]

export interface UaPreset { id: string; label: string; ua: string; mobile: boolean }
export const UA_PRESETS: UaPreset[] = [
  { id: 'ios-safari', label: 'iPhone Safari', mobile: true, ua: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1' },
  { id: 'android-chrome', label: 'Android Chrome', mobile: true, ua: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Mobile Safari/537.36' },
  { id: 'firefox-win', label: 'Firefox (Windows)', mobile: false, ua: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:127.0) Gecko/20100101 Firefox/127.0' },
  { id: 'googlebot', label: 'Googlebot', mobile: false, ua: 'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)' }
]
export const VISION = ['blurredVision', 'reducedContrast', 'achromatopsia', 'deuteranopia', 'protanopia', 'tritanopia'] as const
export type Vision = (typeof VISION)[number]
export type Contrast = 'more' | 'less'

export interface Emu { network?: string; cpu?: number; geo?: string; ua?: string; touch?: boolean; vision?: string; contrast?: Contrast; forcedColors?: boolean; print?: boolean }
export const uaPreset = (id: string | undefined): UaPreset | undefined => UA_PRESETS.find((p) => p.id === id)

/** prefers-color-scheme / reduced-motion (setMedia) ile karsitlik, zorunlu renkler ve yazdirma (Emu) tek bir setEmulatedMedia cagrisinda birlesir. */
export function mediaFeatures(media: { colorScheme?: 'light' | 'dark'; reducedMotion?: boolean } | undefined, e: Emu | undefined): { features: { name: string; value: string }[]; mediaType: '' | 'print' } {
  const features: { name: string; value: string }[] = []
  if (media?.colorScheme) features.push({ name: 'prefers-color-scheme', value: media.colorScheme })
  if (media?.reducedMotion) features.push({ name: 'prefers-reduced-motion', value: 'reduce' })
  if (e?.contrast) features.push({ name: 'prefers-contrast', value: e.contrast })
  if (e?.forcedColors) features.push({ name: 'forced-colors', value: 'active' })
  return { features, mediaType: e?.print ? 'print' : '' }
}
export const networkPreset = (id: string | undefined): NetPreset | undefined => NETWORK_PRESETS.find((p) => p.id === id)
export const geoPreset = (id: string | undefined): GeoPreset | undefined => GEO_PRESETS.find((p) => p.id === id)
export const emuActive = (e: Emu | undefined): boolean => !!e && (!!e.network || (e.cpu ?? 1) > 1 || !!e.geo || !!e.ua || !!e.touch || !!e.vision || !!e.contrast || !!e.forcedColors || !!e.print)

/** CDP komut listesi: verilen emulasyon durumu icin sirasiyla gonderilecek (yontem, parametre) ciftleri. Bos durum = hepsini sifirla. */
export function emulationCommands(e: Emu | undefined): [string, Record<string, unknown>][] {
  const n = networkPreset(e?.network)
  const g = geoPreset(e?.geo)
  return [
    ['Network.emulateNetworkConditions', n ? { offline: n.offline, latency: n.latency, downloadThroughput: n.offline ? 0 : n.down, uploadThroughput: n.offline ? 0 : n.up } : { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 }],
    ['Emulation.setCPUThrottlingRate', { rate: Math.max(1, e?.cpu ?? 1) }],
    g ? ['Emulation.setGeolocationOverride', { latitude: g.latitude, longitude: g.longitude, accuracy: 25 }] : ['Emulation.clearGeolocationOverride', {}],
    ['Emulation.setTimezoneOverride', { timezoneId: g?.timezone ?? '' }],
    ['Emulation.setLocaleOverride', { locale: g?.locale ?? '' }],
    ['Emulation.setUserAgentOverride', { userAgent: uaPreset(e?.ua)?.ua ?? '' }],
    ['Emulation.setTouchEmulationEnabled', { enabled: !!(e?.touch || uaPreset(e?.ua)?.mobile), maxTouchPoints: 5 }],
    ['Emulation.setEmulatedVisionDeficiency', { type: e?.vision && (VISION as readonly string[]).includes(e.vision) ? e.vision : 'none' }]
  ]
}
