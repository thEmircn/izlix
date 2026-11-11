// Site bazli ayarlar (saf): yakinlastirma, zorla karanlik, kullanici CSS'i.
export interface SiteSettings { zoom?: number; dark?: boolean; css?: string }
export const ZOOM_STEPS = [0.5, 0.67, 0.75, 0.8, 0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]
export const MAX_CSS = 20_000

/** Ayar anahtari: kucuk harfli ana bilgisayar adi (http/https disinda yok) */
export function siteHost(url: string): string | null {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:' ? u.hostname.toLowerCase() : null } catch { return null }
}
/** Bir adim yakinlas/uzaklas ('reset': %100) */
export function stepZoom(cur: number, dir: 'in' | 'out' | 'reset'): number {
  if (dir === 'reset') return 1
  const i = ZOOM_STEPS.reduce((best, z, k) => (Math.abs(z - cur) < Math.abs(ZOOM_STEPS[best] - cur) ? k : best), 0)
  return ZOOM_STEPS[Math.max(0, Math.min(ZOOM_STEPS.length - 1, i + (dir === 'in' ? 1 : -1)))]
}
/** Bos/varsayilan degerleri atip kalici hale getirir; hicbir sey kalmadiysa null */
export function normalizeSite(s: SiteSettings): SiteSettings | null {
  const o: SiteSettings = {}
  if (typeof s.zoom === 'number' && s.zoom >= 0.25 && s.zoom <= 5 && Math.abs(s.zoom - 1) > 0.001) o.zoom = Math.round(s.zoom * 100) / 100
  if (s.dark) o.dark = true
  if (typeof s.css === 'string' && s.css.trim()) o.css = s.css.slice(0, MAX_CSS)
  return Object.keys(o).length ? o : null
}
/** Zorla karanlik: sayfayi tersler, gorsel/video/canvas'i tekrar cevirir (renkleri korur) */
export const DARK_CSS = `
html { filter: invert(1) hue-rotate(180deg) !important; background: #fff !important; }
img, picture, video, canvas, svg image, iframe, [style*="background-image"] { filter: invert(1) hue-rotate(180deg) !important; }
`
