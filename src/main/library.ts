import { app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

export interface Visit { url: string; title: string; ts: number }
export interface Bookmark { url: string; title: string; ts: number; /** klasor adi (yoksa kok) */ folder?: string }
interface Data { history: Visit[]; bookmarks: Record<string, Bookmark[]> }

const MAX_HISTORY = 5000

/** Gecmis ve yer imleri (Workspace basina yer imi). Yerel JSON; yalnizca http(s) kaydedilir. */
export class Library {
  private data: Data = { history: [], bookmarks: {} }
  private dir: string
  private timer: NodeJS.Timeout | null = null

  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.dir = dir
    this.data = { history: [], bookmarks: {}, ...(loadDoc<Partial<Data>>(dir, 'library') ?? {}) }
  }

  private save(): void {
    if (this.timer) return
    this.timer = setTimeout(() => { this.timer = null; saveDoc(this.dir, 'library', this.data) }, 500)
  }
  flush(): void { if (this.timer) { clearTimeout(this.timer); this.timer = null } saveDoc(this.dir, 'library', this.data) }

  addVisit(url: string, title: string, now = Date.now()): void {
    if (!/^https?:/.test(url)) return
    const h = this.data.history
    const last = h[h.length - 1]
    if (last && last.url === url) { last.title = title || last.title; last.ts = now } // ayni sayfada baslik guncellemesi
    else h.push({ url, title: title || url, ts: now })
    if (h.length > MAX_HISTORY) h.splice(0, h.length - MAX_HISTORY)
    this.save()
  }
  /** En yeni once, URL basina tek kayit */
  recent(limit = 300): Visit[] {
    const seen = new Set<string>(), out: Visit[] = []
    for (let i = this.data.history.length - 1; i >= 0 && out.length < limit; i--) {
      const v = this.data.history[i]
      if (!seen.has(v.url)) { seen.add(v.url); out.push(v) }
    }
    return out
  }
  /** Disaridan (Chrome) iceri aktarma: yineleneni atlar, gecmisi zamana gore birlestirir. Eklenen sayilari doner. */
  importData(wsId: string, bookmarks: { url: string; title: string }[], visits: Visit[]): { bookmarks: number; history: number } {
    const list = this.bookmarks(wsId), have = new Set(list.map((b) => b.url)); let nb = 0
    for (const b of bookmarks) if (!have.has(b.url)) { have.add(b.url); list.push({ url: b.url, title: b.title, ts: Date.now() }); nb++ }
    this.data.bookmarks[wsId] = list
    const key = (v: Visit): string => `${v.url}@${Math.floor(v.ts / 60000)}`
    const seen = new Set(this.data.history.map(key)); let nh = 0
    for (const v of visits) if (/^https?:/.test(v.url) && !seen.has(key(v))) { seen.add(key(v)); this.data.history.push({ url: v.url, title: v.title, ts: v.ts }); nh++ }
    this.data.history.sort((a, b) => a.ts - b.ts)
    if (this.data.history.length > MAX_HISTORY) this.data.history.splice(0, this.data.history.length - MAX_HISTORY)
    this.save()
    return { bookmarks: nb, history: nh }
  }
  /** Gecmis sayfasi: her ziyaret ayri satir, en yeni once; `q` url/baslikta aranir */
  visits(q = '', limit = 1500): Visit[] {
    const needle = q.trim().toLowerCase(), out: Visit[] = []
    for (let i = this.data.history.length - 1; i >= 0 && out.length < limit; i--) {
      const v = this.data.history[i]
      if (!needle || v.url.toLowerCase().includes(needle) || v.title.toLowerCase().includes(needle)) out.push(v)
    }
    return out
  }
  /** Bir adresin tum ziyaretlerini (ts verilirse yalniz o ziyareti) siler; silinen sayisini doner */
  removeVisits(url: string, ts?: number): number {
    const before = this.data.history.length
    this.data.history = this.data.history.filter((v) => !(v.url === url && (ts === undefined || v.ts === ts)))
    this.save(); return before - this.data.history.length
  }
  /** `since` (epoch ms) ve sonrasini siler; since=0: tum gecmis */
  clearSince(since: number): number {
    const before = this.data.history.length
    this.data.history = since <= 0 ? [] : this.data.history.filter((v) => v.ts < since)
    this.save(); return before - this.data.history.length
  }
  // ---- yer imi yonetimi: duzenleme, klasorler ----
  updateBookmark(wsId: string, url: string, patch: { title?: string; url?: string; folder?: string | null }): boolean {
    const b = this.bookmarks(wsId).find((x) => x.url === url); if (!b) return false
    if (patch.title !== undefined) b.title = patch.title.slice(0, 300) || b.url
    if (patch.url !== undefined && /^https?:\/\//.test(patch.url) && !this.bookmarks(wsId).some((x) => x !== b && x.url === patch.url)) b.url = patch.url
    if (patch.folder !== undefined) { if (patch.folder) b.folder = patch.folder.slice(0, 80); else delete b.folder }
    this.save(); return true
  }
  removeBookmark(wsId: string, url: string): boolean {
    const l = this.bookmarks(wsId), i = l.findIndex((x) => x.url === url); if (i < 0) return false
    l.splice(i, 1); this.data.bookmarks[wsId] = l; this.save(); return true
  }
  folders(wsId: string): string[] { return [...new Set(this.bookmarks(wsId).map((b) => b.folder).filter((f): f is string => !!f))].sort((a, b) => a.localeCompare(b)) }
  /** Klasoru yeniden adlandirir (to bos degilse) ya da siler (icindekiler koke tasinir) */
  editFolder(wsId: string, name: string, to?: string): number {
    let n = 0
    for (const b of this.bookmarks(wsId)) if (b.folder === name) { if (to) b.folder = to.slice(0, 80); else delete b.folder; n++ }
    if (n) this.save(); return n
  }
  clearHistory(): void { this.data.history = []; this.save() }

  bookmarks(wsId: string): Bookmark[] { return this.data.bookmarks[wsId] ?? [] }
  isBookmarked(wsId: string, url: string): boolean { return this.bookmarks(wsId).some((b) => b.url === url) }
  toggleBookmark(wsId: string, url: string, title: string, now = Date.now()): boolean {
    if (!/^https?:/.test(url)) return false
    const list = this.bookmarks(wsId)
    const i = list.findIndex((b) => b.url === url)
    if (i >= 0) list.splice(i, 1); else list.push({ url, title: title || url, ts: now })
    this.data.bookmarks[wsId] = list
    this.save()
    return i < 0
  }
}
