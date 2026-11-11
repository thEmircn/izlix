import type { DevToolsDock } from './events'

export interface Rect { x: number; y: number; width: number; height: number }
/** Kartlar arasi/pencere kenari boslugu (px): her yuva bu kadar iceri cekilir, boylece sayfa ve paneller yuvarlak kart gibi gorunur. */
export const GAP = 6
export const CARD_RADIUS = 12
export const padRect = (r: Rect, g = GAP): Rect => ({ x: r.x + g, y: r.y + g, width: Math.max(0, r.width - 2 * g), height: Math.max(0, r.height - 2 * g) })

export type PanelSide = 'right' | 'left' | 'bottom'
export interface LayoutParams { dock: DevToolsDock; panelRatio: number; chromeHeight: number; /** yan panel konumu (yalnizca Chrome DevTools kapaliyken; 'bottom'ta oran yukseklige uygulanir) */ side?: PanelSide; /** sagda Timeline'in yuksekligi (govdeye oran); varsayilan 0.52 */ split?: number }
export interface Layout { page: Rect; timeline: Rect; devtools: Rect | null }

/**
 * Shell (renderer) ve main ayni hesabi kullanir: sayfa gorunumu, Timeline paneli ve DevTools
 * tek yerde hesaplanir, boylece shell'in DOM'u ile WebContentsView sinirlari kaymaz.
 *  - right : sayfa solda; sagda ustte Timeline, altta DevTools
 *  - bottom: sayfa solda, Timeline sagda; DevTools altta tam genislikte
 *  - off   : sayfa solda, Timeline sagda tam yukseklikte; DevTools kapali
 */
export function computeLayout(width: number, height: number, { dock, panelRatio, chromeHeight, split = 0.52, side = 'right' }: LayoutParams): Layout {
  const bodyH = Math.max(0, height - chromeHeight)
  if (dock === 'off' && side === 'left') {
    const w = Math.round(width * panelRatio)
    return { page: { x: w, y: chromeHeight, width: width - w, height: bodyH }, timeline: { x: 0, y: chromeHeight, width: w, height: bodyH }, devtools: null }
  }
  if (dock === 'off' && side === 'bottom') {
    const h = Math.round(bodyH * panelRatio)
    return { page: { x: 0, y: chromeHeight, width, height: bodyH - h }, timeline: { x: 0, y: chromeHeight + bodyH - h, width, height: h }, devtools: null }
  }
  const panelW = Math.round(width * panelRatio)
  const pageW = width - panelW
  const right = (y: number, h: number): Rect => ({ x: pageW, y, width: panelW, height: h })

  if (dock === 'right') {
    const tlH = Math.round(bodyH * Math.min(0.8, Math.max(0.2, split)))
    return {
      page: { x: 0, y: chromeHeight, width: pageW, height: bodyH },
      timeline: right(chromeHeight, tlH),
      devtools: right(chromeHeight + tlH, bodyH - tlH)
    }
  }
  if (dock === 'bottom') {
    const dtH = Math.round(bodyH * 0.4)
    return {
      page: { x: 0, y: chromeHeight, width: pageW, height: bodyH - dtH },
      timeline: right(chromeHeight, bodyH - dtH),
      devtools: { x: 0, y: chromeHeight + bodyH - dtH, width, height: dtH }
    }
  }
  return { page: { x: 0, y: chromeHeight, width: pageW, height: bodyH }, timeline: right(chromeHeight, bodyH), devtools: null }
}
