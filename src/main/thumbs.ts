import { BrowserWindow, type NativeImage } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { isLoopbackOrigin, originKey, thumbKey } from '../shared/favicon'

const MAX_ENTRIES = 120
type Doc = Record<string, { u: string; t: number }>

/** Sayfa onizlemeleri (kucuk JPEG data URL). Yalnizca kullanicinin gordugu sayfalar saklanir; gizli sekmeler hic yazilmaz. */
export class ThumbStore {
  private data: Doc
  private timer: NodeJS.Timeout | null = null
  private inflight = new Map<string, Promise<string | null>>()
  constructor(private dir: string) { this.data = loadDoc<Doc>(dir, 'thumbs') ?? {} }

  /** Tam adres yoksa ayni kaynagin son goruntusu */
  get(url: string): string | null {
    const k = thumbKey(url); if (!k) return null
    const o = originKey(url)
    return this.data[k]?.u ?? (o ? this.data[o + '#']?.u : undefined) ?? null
  }
  recentlyHas(url: string, ms: number): boolean { const k = thumbKey(url); return !!k && !!this.data[k] && Date.now() - this.data[k].t < ms }

  put(url: string, img: NativeImage): void {
    const k = thumbKey(url), o = originKey(url); if (!k || !o || img.isEmpty()) return
    const s = img.getSize(); const small = s.width > 360 ? img.resize({ width: 360, quality: 'good' }) : img
    const u = `data:image/jpeg;base64,${small.toJPEG(55).toString('base64')}`
    const t = Date.now(); this.data[k] = { u, t }; this.data[o + '#'] = { u, t }
    const keys = Object.keys(this.data)
    if (keys.length > MAX_ENTRIES) for (const x of keys.sort((a, b) => this.data[a].t - this.data[b].t).slice(0, keys.length - MAX_ENTRIES)) delete this.data[x]
    this.timer ??= setTimeout(() => { this.timer = null; this.flush() }, 3000)
  }
  flush(): void { if (this.timer) { clearTimeout(this.timer); this.timer = null } try { saveDoc(this.dir, 'thumbs', this.data) } catch { /* disk */ } }

  /** Yalnizca loopback: gizli (gorunmez) pencerede sayfayi yukleyip goruntusunu alir. */
  captureHidden(url: string): Promise<string | null> {
    const o = originKey(url)
    if (!o || !isLoopbackOrigin(o)) return Promise.resolve(null)
    let p = this.inflight.get(o)
    if (!p) {
      p = (async () => {
        const w = new BrowserWindow({ show: false, width: 1100, height: 700, focusable: false, webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false, partition: 'thumb-tmp', backgroundThrottling: false } })
        try {
          w.webContents.setAudioMuted(true)
          await Promise.race([w.loadURL(o + '/'), new Promise((_r, rej) => setTimeout(() => rej(new Error('timeout')), 6000))])
          await new Promise((r) => setTimeout(r, 900))
          this.put(o + '/', await w.webContents.capturePage())
        } catch { /* sunucu kapali */ } finally { if (!w.isDestroyed()) w.destroy() }
        return this.get(o + '/')
      })().finally(() => { this.inflight.delete(o) })
      this.inflight.set(o, p)
    }
    return p
  }
}
