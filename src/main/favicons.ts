import { net, type Session } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { iconMime, isLoopbackOrigin, originKey, parseIconLinks } from '../shared/favicon'

const MAX_ENTRIES = 300
type Doc = Record<string, { u: string; t: number }>

/** Site ikonlari: kaynak anahtari -> data URL. Yalnizca ziyaret edilen sayfalarin ikonlari saklanir; disaridan yalnizca loopback adreslerinden istek atilir. */
export class FaviconStore {
  private data: Doc
  private timer: NodeJS.Timeout | null = null
  private inflight = new Map<string, Promise<void>>()
  constructor(private dir: string, private onNew: (origin: string, url: string) => void = () => {}) { this.data = loadDoc<Doc>(dir, 'favicons') ?? {} }

  get(origin: string): string | undefined { return this.data[origin]?.u }
  all(): Record<string, string> { return Object.fromEntries(Object.entries(this.data).map(([k, v]) => [k, v.u])) }
  pick(origins: string[]): Record<string, string> { const o: Record<string, string> = {}; for (const k of origins) { const v = this.data[k]?.u; if (v) o[k] = v } return o }

  set(origin: string, dataUrl: string): void {
    if (this.data[origin]?.u === dataUrl) return
    this.data[origin] = { u: dataUrl, t: Date.now() }
    const keys = Object.keys(this.data)
    if (keys.length > MAX_ENTRIES) for (const k of keys.sort((a, b) => this.data[a].t - this.data[b].t).slice(0, keys.length - MAX_ENTRIES)) delete this.data[k]
    this.onNew(origin, dataUrl)
    this.timer ??= setTimeout(() => { this.timer = null; this.flush() }, 1500)
  }
  flush(): void { if (this.timer) { clearTimeout(this.timer); this.timer = null } try { saveDoc(this.dir, 'favicons', this.data) } catch { /* disk */ } }

  /** Sayfanin bildirdigi ikon adaylarindan ilk gecerliyi (sekmenin oturumuyla) indirip kaydeder. */
  async capture(ses: Session, pageUrl: string, candidates: string[]): Promise<void> {
    const origin = originKey(pageUrl); if (!origin) return
    for (const u of candidates.slice(0, 4)) {
      const d = await this.fetchIcon((x) => ses.fetch(x), u).catch(() => null)
      if (d) { this.set(origin, d); return }
    }
  }

  /** Yalnizca loopback: ziyaret edilmemis dev sunucusunun ikonunu sayfa HTML'inden / favicon.ico'dan bulur. */
  ensureLoopback(origin: string): Promise<void> {
    if (!isLoopbackOrigin(origin) || this.data[origin]) return Promise.resolve()
    let p = this.inflight.get(origin)
    if (!p) {
      p = (async () => {
        const f = (x: string): Promise<Response> => net.fetch(x, { signal: AbortSignal.timeout(2500) })
        let list: string[] = []
        try { const r = await f(origin + '/'); if (r.ok && /html/i.test(r.headers.get('content-type') ?? '')) list = parseIconLinks(await r.text(), origin + '/') } catch { return }
        for (const u of [...list.filter((x) => isLoopbackOrigin(originKey(x) ?? '')), origin + '/favicon.ico']) {
          const d = await this.fetchIcon(f, u).catch(() => null)
          if (d) { this.set(origin, d); return }
        }
      })().finally(() => { this.inflight.delete(origin) })
      this.inflight.set(origin, p)
    }
    return p
  }

  private async fetchIcon(f: (u: string) => Promise<Response>, url: string): Promise<string | null> {
    if (url.startsWith('data:')) return url.length <= 80_000 && /^data:image\/(png|x-icon|vnd\.microsoft\.icon|jpeg|gif|webp|svg\+xml|avif)[;,]/.test(url) ? url : null
    if (!/^https?:/.test(url)) return null
    const r = await f(url); if (!r.ok) return null
    const buf = Buffer.from(await r.arrayBuffer()), mime = iconMime(r.headers.get('content-type'), url, buf.length)
    return mime ? `data:${mime};base64,${buf.toString('base64')}` : null
  }
}
