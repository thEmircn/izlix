import { app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

export interface Visit { url: string; title: string; ts: number }
export interface Bookmark { url: string; title: string; ts: number }
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
