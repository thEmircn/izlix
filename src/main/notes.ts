import { loadDoc, saveDoc } from './docdb'
import { pageKey, type Note } from '../shared/notes'

const MAX = 2000
/** Sayfa notlari/vurgulari: yerel (docdb 'notes'), sayfa adresine (hash'siz) bagli. */
export class NoteStore {
  private list: Note[]
  private timer: NodeJS.Timeout | null = null
  constructor(private dir: string) { this.list = loadDoc<Note[]>(dir, 'notes') ?? [] }
  private save(): void { if (this.timer) return; this.timer = setTimeout(() => { this.timer = null; try { saveDoc(this.dir, 'notes', this.list) } catch { /* disk */ } }, 500) }
  flush(): void { if (this.timer) { clearTimeout(this.timer); this.timer = null } try { saveDoc(this.dir, 'notes', this.list) } catch { /* disk */ } }
  forPage(url: string): Note[] { const k = pageKey(url); return k ? this.list.filter((n) => n.url === k) : [] }
  all(): Note[] { return [...this.list].sort((a, b) => b.ts - a.ts) }
  get(id: string): Note | undefined { return this.list.find((n) => n.id === id) }
  add(url: string, c: { text: string; prefix: string; suffix: string }, note?: string, color = 'yellow', now = Date.now()): Note | null {
    const k = pageKey(url); if (!k) return null
    if (this.list.some((n) => n.url === k && n.text === c.text && n.prefix === c.prefix)) return this.list.find((n) => n.url === k && n.text === c.text && n.prefix === c.prefix)! // ayni vurgu iki kez eklenmez
    const n: Note = { id: `n${now.toString(36)}${Math.random().toString(36).slice(2, 6)}`, url: k, text: c.text.slice(0, 2000), prefix: c.prefix.slice(0, 40), suffix: c.suffix.slice(0, 40), ...(note ? { note: note.slice(0, 2000) } : {}), color, ts: now }
    this.list.push(n); if (this.list.length > MAX) this.list.splice(0, this.list.length - MAX)
    this.save(); return n
  }
  update(id: string, patch: { note?: string; color?: string }): Note | null {
    const n = this.get(id); if (!n) return null
    if (patch.note !== undefined) { if (patch.note.trim()) n.note = patch.note.slice(0, 2000); else delete n.note }
    if (patch.color) n.color = patch.color
    this.save(); return n
  }
  /** esitleme: verilen listeyi (zaten birlestirilmis) yerine koyar */
  replaceAll(list: Note[]): void { this.list = list.slice(-MAX); this.save() }
  remove(id: string): Note | null { const i = this.list.findIndex((n) => n.id === id); if (i < 0) return null; const [n] = this.list.splice(i, 1); this.save(); return n }
}
