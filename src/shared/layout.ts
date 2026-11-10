import type { DevToolsDock } from './events'

export interface Rect { x: number; y: number; width: number; height: number }
export interface LayoutParams { dock: DevToolsDock; panelRatio: number; chromeHeight: number; /** sagda Timeline'in yuksekligi (govdeye oran); varsayilan 0.52 */ split?: number }
export interface Layout { page: Rect; timeline: Rect; devtools: Rect | null }

/**
 * Shell (renderer) ve main ayni hesabi kullanir: sayfa gorunumu, Timeline paneli ve DevTools
 * tek yerde hesaplanir, boylece shell'in DOM'u ile WebContentsView sinirlari kaymaz.
 *  - right : sayfa solda; sagda ustte Timeline, altta DevTools
 *  - bottom: sayfa solda, Timeline sagda; DevTools altta tam genislikte
 *  - off   : sayfa solda, Timeline sagda tam yukseklikte; DevTools kapali
 */
export function computeLayout(width: number, height: number, { dock, panelRatio, chromeHeight, split = 0.52 }: LayoutParams): Layout {
  const bodyH = Math.max(0, height - chromeHeight)
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
