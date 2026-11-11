import { app, shell, type DownloadItem, type Session } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

export interface DownloadInfo { id: string; name: string; path: string; received: number; total: number; state: 'progressing' | 'completed' | 'cancelled' | 'interrupted'; url?: string; paused?: boolean; startedAt?: number; /** bayt/sn (son guncellemelerden) */ speed?: number; /** dosya diskten silinmis (gecmis kaydi) */ missing?: boolean }

/** "dosya.pdf" varsa "dosya (1).pdf" ... (saf; test icin exists enjekte edilebilir) */
export function uniquePath(dir: string, filename: string, exists: (p: string) => boolean = existsSync): string {
  const safe = basename(filename) || 'download'
  const ext = extname(safe), stem = safe.slice(0, safe.length - ext.length)
  let p = join(dir, safe), n = 1
  while (exists(p)) p = join(dir, `${stem} (${n++})${ext}`)
  return p
}

/** Indirmeler: dosya ~/Downloads'a kaydedilir (iletisim kutusu yok); ilerleme shell'e bildirilir. */
export class Downloads {
  private items = new Map<string, DownloadInfo>()
  private live = new Map<string, DownloadItem>()
  private attached = new WeakSet<Session>()
  private seq = 0
  private timer: NodeJS.Timeout | null = null
  constructor(private onChange: () => void, private dir: string = app.getPath('userData')) {
    // onceki oturumlarin tamamlanmis indirmeleri (gecmis)
    for (const d of loadDoc<DownloadInfo[]>(dir, 'downloads') ?? []) { this.items.set(`old-${++this.seq}`, { ...d, id: `old-${this.seq}`, state: d.state === 'progressing' ? 'interrupted' : d.state, paused: false, speed: 0 }) }
  }
  private save(): void {
    if (this.timer) return
    this.timer = setTimeout(() => { this.timer = null; try { saveDoc(this.dir, 'downloads', [...this.items.values()].filter((d) => d.state !== 'progressing').slice(-200)) } catch { /* disk */ } }, 800)
  }
  /** Arayuze giden son indirmeler (dosyasi silinenler isaretlenir) */
  list(): DownloadInfo[] { return [...this.items.values()].slice(-100).map((d) => (d.state === 'completed' && !existsSync(d.path) ? { ...d, missing: true } : d)) }
  /** Yonetici islemleri */
  pause(id: string): boolean { const i = this.live.get(id), d = this.items.get(id); if (!i || !d || i.isPaused()) return false; i.pause(); d.paused = true; d.speed = 0; this.onChange(); return true }
  resume(id: string): boolean { const i = this.live.get(id), d = this.items.get(id); if (!i || !d || !i.canResume()) return false; i.resume(); d.paused = false; this.onChange(); return true }
  cancel(id: string): boolean { const i = this.live.get(id), d = this.items.get(id); if (!i || !d) return false; i.cancel(); return true }
  open(id: string): void { const d = this.items.get(id); if (d && d.state === 'completed') void shell.openPath(d.path) }
  /** Listeden kaldir (dosya silinmez); suren indirme kaldirilamaz */
  remove(id: string): boolean { const d = this.items.get(id); if (!d || d.state === 'progressing') return false; this.items.delete(id); this.save(); this.onChange(); return true }
  clearDone(): number { let n = 0; for (const [id, d] of this.items) if (d.state !== 'progressing') { this.items.delete(id); n++ } if (n) { this.save(); this.onChange() } return n }

  attach(ses: Session): void {
    if (this.attached.has(ses)) return
    this.attached.add(ses)
    ses.on('will-download', (_e, item) => {
      const id = `dl-${++this.seq}`
      const path = uniquePath(process.env.DB_OUT_DIR || app.getPath('downloads'), item.getFilename())
      item.setSavePath(path)
      const info: DownloadInfo = { id, name: basename(path), path, received: 0, total: item.getTotalBytes(), state: 'progressing', url: item.getURL(), startedAt: Date.now(), speed: 0 }
      this.items.set(id, info); this.live.set(id, item); this.onChange()
      let lastT = Date.now(), lastB = 0
      item.on('updated', (_ev, state) => {
        const now = Date.now(), b = item.getReceivedBytes()
        if (now - lastT >= 700) { info.speed = Math.max(0, Math.round(((b - lastB) / (now - lastT)) * 1000)); lastT = now; lastB = b }
        info.received = b; info.total = item.getTotalBytes(); info.paused = item.isPaused(); info.state = state === 'interrupted' ? 'interrupted' : 'progressing'; this.onChange()
      })
      item.once('done', (_ev, state) => { info.state = state; info.received = item.getReceivedBytes(); info.speed = 0; info.paused = false; this.live.delete(id); this.save(); this.onChange() })
    })
  }

  show(id: string): void { const d = this.items.get(id); if (d) shell.showItemInFolder(d.path) }
}
