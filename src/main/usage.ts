import { loadDoc, saveDoc } from './docdb'
import { addSeconds, dayKey, prune, type Usage } from '../shared/usage'

/** Site kullanim suresi (gun -> site -> saniye): yerel, son 60 gun. */
export class UsageStore {
  private u: Usage
  private timer: NodeJS.Timeout | null = null
  constructor(private dir: string) { this.u = loadDoc<Usage>(dir, 'usage') ?? {}; prune(this.u, 60) }
  add(site: string, sec = 1, now = new Date()): void { addSeconds(this.u, site, sec, dayKey(now)); this.timer ??= setTimeout(() => { this.timer = null; this.flush() }, 30_000) }
  usedToday(site: string, now = new Date()): number { return this.u[dayKey(now)]?.[site] ?? 0 }
  all(): Usage { return this.u }
  flush(): void { if (this.timer) { clearTimeout(this.timer); this.timer = null } try { saveDoc(this.dir, 'usage', this.u) } catch { /* disk */ } }
}
