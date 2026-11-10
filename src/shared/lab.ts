// Responsive Lab (MVP #7): hazir cihaz listesi ve yan yana yerlesim hesabi (saf mantik).
export interface Device { id: string; label: string; width: number; height: number; dpr: number; mobile: boolean }

const MOBILE_UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1'
export const MOBILE_USER_AGENT = MOBILE_UA

export const DEVICES: Device[] = [
  { id: 'iphone-se', label: 'iPhone SE', width: 375, height: 667, dpr: 2, mobile: true },
  { id: 'iphone-15', label: 'iPhone 15', width: 393, height: 852, dpr: 3, mobile: true },
  { id: 'iphone-15-pro-max', label: 'iPhone 15 Pro Max', width: 430, height: 932, dpr: 3, mobile: true },
  { id: 'pixel-8', label: 'Pixel 8', width: 412, height: 915, dpr: 2.6, mobile: true },
  { id: 'galaxy-fold', label: 'Galaxy Z Fold (kapalı)', width: 280, height: 653, dpr: 3, mobile: true },
  { id: 'ipad-mini', label: 'iPad mini', width: 744, height: 1133, dpr: 2, mobile: true },
  { id: 'ipad-pro-11', label: 'iPad Pro 11"', width: 834, height: 1194, dpr: 2, mobile: true },
  { id: 'laptop', label: 'Laptop 1280', width: 1280, height: 800, dpr: 2, mobile: false },
  { id: 'desktop', label: 'Desktop 1440', width: 1440, height: 900, dpr: 1, mobile: false },
  { id: 'full-hd', label: 'Full HD 1920', width: 1920, height: 1080, dpr: 1, mobile: false }
]
export const deviceById = (id: string): Device | undefined => DEVICES.find((d) => d.id === id)
export const MAX_VIEWPORTS = 4

export interface Rect { x: number; y: number; width: number; height: number }
export interface Slot extends Rect { scale: number }

/**
 * Viewport'lari verilen alana siglayan en buyuk olcegi bulur. Tek satir veya (3+ viewport icin) iki satir denenir.
 * Her slot, cihazin gercek boyutu * olcek kadar yer kaplar; sayfa Emulation `scale` ile ayni oranda kucultulur.
 */
export function computeLabLayout(area: Rect, sizes: { width: number; height: number }[], gap = 8): Slot[] {
  const n = sizes.length
  if (!n) return []
  const rowsFor = (rows: number[][]): { scale: number; slots: Slot[] } => {
    let scale = 1
    for (const r of rows) {
      const sumW = r.reduce((a, i) => a + sizes[i].width, 0)
      scale = Math.min(scale, (area.width - gap * (r.length - 1)) / sumW)
    }
    const rowMaxH = rows.map((r) => Math.max(...r.map((i) => sizes[i].height)))
    const sumH = rowMaxH.reduce((a, b) => a + b, 0)
    scale = Math.min(scale, (area.height - gap * (rows.length - 1)) / sumH)
    scale = Math.max(0.05, scale)
    const slots: Slot[] = new Array(n)
    let y = area.y
    rows.forEach((r, ri) => {
      let x = area.x
      for (const i of r) {
        slots[i] = { x: Math.round(x), y: Math.round(y), width: Math.round(sizes[i].width * scale), height: Math.round(sizes[i].height * scale), scale }
        x += sizes[i].width * scale + gap
      }
      y += rowMaxH[ri] * scale + gap
    })
    return { scale, slots }
  }
  const all = Array.from({ length: n }, (_, i) => i)
  const one = rowsFor([all])
  if (n < 3) return one.slots
  const half = Math.ceil(n / 2)
  const two = rowsFor([all.slice(0, half), all.slice(half)])
  return (two.scale > one.scale ? two : one).slots
}
