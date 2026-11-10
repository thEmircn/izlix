import { app, shell, type Session } from 'electron'
import { existsSync } from 'node:fs'
import { basename, extname, join } from 'node:path'

export interface DownloadInfo { id: string; name: string; path: string; received: number; total: number; state: 'progressing' | 'completed' | 'cancelled' | 'interrupted' }

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
  private attached = new WeakSet<Session>()
  private seq = 0
  constructor(private onChange: () => void) {}

  list(): DownloadInfo[] { return [...this.items.values()].slice(-20) }

  attach(ses: Session): void {
    if (this.attached.has(ses)) return
    this.attached.add(ses)
    ses.on('will-download', (_e, item) => {
      const id = `dl-${++this.seq}`
      const path = uniquePath(app.getPath('downloads'), item.getFilename())
      item.setSavePath(path)
      const info: DownloadInfo = { id, name: basename(path), path, received: 0, total: item.getTotalBytes(), state: 'progressing' }
      this.items.set(id, info); this.onChange()
      item.on('updated', (_ev, state) => { info.received = item.getReceivedBytes(); info.total = item.getTotalBytes(); info.state = state === 'interrupted' ? 'interrupted' : 'progressing'; this.onChange() })
      item.once('done', (_ev, state) => { info.state = state; info.received = item.getReceivedBytes(); this.onChange() })
    })
  }

  show(id: string): void { const d = this.items.get(id); if (d) shell.showItemInFolder(d.path) }
}
