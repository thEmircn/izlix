import { loadDoc, saveDoc } from './docdb'
import type { Metrics } from '../shared/budgets'

const KEEP = 10, MAX_PAGES = 200
/** Sayfa basina son olcumler (oturumlar arasi karsilastirma): yerel, docdb 'perfhist'. */
export class PerfHistory {
  private data: Record<string, Metrics[]>
  constructor(private dir: string) { this.data = loadDoc<Record<string, Metrics[]>>(dir, 'perfhist') ?? {} }
  list(key: string): Metrics[] { return this.data[key] ?? [] }
  add(key: string, m: Metrics): void {
    const l = (this.data[key] ??= []); l.push(m); if (l.length > KEEP) l.splice(0, l.length - KEEP)
    const keys = Object.keys(this.data); if (keys.length > MAX_PAGES) delete this.data[keys[0]]
    try { saveDoc(this.dir, 'perfhist', this.data) } catch { /* disk */ }
  }
}
