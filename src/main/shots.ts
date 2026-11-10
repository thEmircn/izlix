import type { WebContents } from 'electron'

export type ShotKind = 'viewport' | 'full' | 'node'

/** izlix-<host>-<zaman>.png */
export function shotName(url: string, now = new Date()): string {
  let host = 'page'
  try { host = new URL(url).hostname.replace(/[^\w.-]/g, '') || 'page' } catch { /* ham */ }
  return `izlix-${host}-${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.png`
}

/** CDP ile PNG: gorunur alan, tum sayfa (beyond viewport) veya bir DOM dugumunun kutusu. */
export async function captureShot(wc: WebContents, kind: ShotKind, nodeId?: number): Promise<Buffer | null> {
  const dbg = wc.debugger
  const send = (m: string, p?: object): Promise<any> => dbg.sendCommand(m, p ?? {})
  try {
    if (kind === 'viewport') return Buffer.from((await send('Page.captureScreenshot', { format: 'png' })).data, 'base64')
    if (kind === 'full') {
      const m = await send('Page.getLayoutMetrics')
      const c = m.cssContentSize ?? m.contentSize
      const w = Math.ceil(c.width), h = Math.min(Math.ceil(c.height), 16384) // Chromium sinirina karsi tavan
      return Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w, height: h, scale: 1 } })).data, 'base64')
    }
    if (nodeId == null) return null
    const box = (await send('DOM.getBoxModel', { nodeId })).model
    const q = box.border as number[]
    const x = Math.min(q[0], q[6]), y = Math.min(q[1], q[3])
    const width = Math.max(1, Math.max(q[2], q[4]) - x), height = Math.max(1, Math.max(q[5], q[7]) - y)
    // sayfa kaydirilmis olabilir: DOM koordinatlari belge-bagimli; captureBeyondViewport ile belge koordinatlari kullanilir
    const lm = await send('Page.getLayoutMetrics')
    const vx = lm.cssVisualViewport?.pageX ?? 0, vy = lm.cssVisualViewport?.pageY ?? 0
    return Buffer.from((await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: x + vx, y: y + vy, width, height, scale: 1 } })).data, 'base64')
  } catch { return null }
}
