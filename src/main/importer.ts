import { copyFileSync, existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { chromeTimeToMs, parseChromeBookmarks, type ImpBookmark } from '../shared/importchrome'

export const CHROME_DIR = join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome', 'Default')
export interface Imported { bookmarks: ImpBookmark[]; visits: { url: string; title: string; ts: number }[] }

/** Chrome profilini (salt okunur) okur: yer imleri JSON, gecmis SQLite (kilitli oldugu icin gecici kopyadan). Bulunamazsa null. */
export function readChromeProfile(dir = CHROME_DIR, maxVisits = 3000): Imported | null {
  const bm = join(dir, 'Bookmarks'), hist = join(dir, 'History')
  if (!existsSync(bm) && !existsSync(hist)) return null
  let bookmarks: ImpBookmark[] = []
  try { if (existsSync(bm)) bookmarks = parseChromeBookmarks(JSON.parse(readFileSync(bm, 'utf8'))) } catch { /* bozuk dosya */ }
  const visits: Imported['visits'] = []
  if (existsSync(hist)) {
    const tmp = mkdtempSync(join(tmpdir(), 'db-chrome-'))
    try {
      const copy = join(tmp, 'History'); copyFileSync(hist, copy)
      const db = new DatabaseSync(copy, { readOnly: true })
      try {
        // Chrome zamani ~1.3e16 (> 2^53): BigInt olarak oku, ms'e BigInt ile indir
        const st = db.prepare("SELECT url, title, last_visit_time AS t FROM urls WHERE (url LIKE 'http://%' OR url LIKE 'https://%') AND last_visit_time > 0 ORDER BY last_visit_time DESC LIMIT ?")
        st.setReadBigInts(true)
        const rows = st.all(maxVisits) as unknown as { url: string; title: string; t: bigint }[]
        for (const r of rows) visits.push({ url: r.url, title: r.title || r.url, ts: chromeTimeToMs(Number(r.t / 1000n) * 1000) })
      } finally { db.close() }
    } catch { /* surum/kilit sorunu: yalnizca yer imleri */ } finally { rmSync(tmp, { recursive: true, force: true }) }
  }
  return { bookmarks, visits }
}
