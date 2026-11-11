import { app, type WebContents } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { DARK_CSS, normalizeSite, siteHost, type SiteSettings } from '../shared/sites'

/** Site bazli ayarlar (yakinlastirma, karanlik, kullanici CSS'i): kalici (docdb 'sites'); sayfalara dom-ready'de ve degisince uygulanir. */
export class SiteStore {
  private data: Record<string, SiteSettings>
  private css = new Map<number, { dark?: string; user?: string }>() // wc.id -> insertCSS anahtarlari
  constructor(private dir = app.getPath('userData')) { this.data = loadDoc<Record<string, SiteSettings>>(dir, 'sites') ?? {} }
  get(host: string): SiteSettings { return this.data[host] ?? {} }
  all(): Record<string, SiteSettings> { return this.data }
  set(host: string, s: SiteSettings): void {
    const n = normalizeSite(s)
    if (n) this.data[host] = n; else delete this.data[host]
    saveDoc(this.dir, 'sites', this.data)
  }
  /** Sayfaya (yeniden) uygula: zoom + karanlik + kullanici CSS */
  async apply(wc: WebContents): Promise<void> {
    if (wc.isDestroyed()) return
    const host = siteHost(wc.getURL()); const s = host ? this.get(host) : {}
    const prev = this.css.get(wc.id) ?? {}
    if (prev.dark) { await wc.removeInsertedCSS(prev.dark).catch(() => {}); prev.dark = undefined }
    if (prev.user) { await wc.removeInsertedCSS(prev.user).catch(() => {}); prev.user = undefined }
    wc.setZoomFactor(s.zoom ?? 1)
    if (s.dark) prev.dark = await wc.insertCSS(DARK_CSS).catch(() => undefined)
    if (s.css) prev.user = await wc.insertCSS(s.css).catch(() => undefined)
    this.css.set(wc.id, prev)
  }
}
