import { execFileSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdtempSync, rmSync } from 'node:fs'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { parseSafariBookmarks, safariTimeToMs } from '../shared/importsafari'
import type { Imported } from './importer'

export const SAFARI_DIR = join(homedir(), 'Library', 'Safari')
export type SafariResult = { ok: true; data: Imported } | { ok: false; reason: 'missing' | 'denied' }

/** Safari verisi (salt okunur). ~/Library/Safari korumali: uygulamaya Tam Disk Erisimi verilmediyse EPERM/EACCES -> 'denied'. */
export function readSafariProfile(dir = SAFARI_DIR, maxVisits = 3000): SafariResult {
  const bm = join(dir, 'Bookmarks.plist'), hist = join(dir, 'History.db')
  if (!existsSync(bm) && !existsSync(hist)) {
    // existsSync, izin yokken de false doner: klasoru gercekten listeleyip nedenini ayir
    try { execFileSync('/bin/ls', [dir], { stdio: ['ignore', 'ignore', 'pipe'] }) } catch (e) { return { ok: false, reason: /not permitted|denied/i.test(String((e as { stderr?: Buffer }).stderr ?? e)) ? 'denied' : 'missing' } }
    return { ok: false, reason: 'missing' }
  }
  let bookmarks: Imported['bookmarks'] = []
  const visits: Imported['visits'] = []
  let denied = false
  try { if (existsSync(bm)) bookmarks = parseSafariBookmarks(JSON.parse(execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', bm], { maxBuffer: 64 * 1024 * 1024 }).toString())) } catch (e) { if (/Operation not permitted|EPERM|EACCES/i.test(String(e))) denied = true }
  if (existsSync(hist)) {
    const tmp = mkdtempSync(join(tmpdir(), 'db-safari-'))
    try {
      const copy = join(tmp, 'History.db'); copyFileSync(hist, copy)
      const db = new DatabaseSync(copy, { readOnly: true })
      try {
        const rows = db.prepare('SELECT i.url AS url, v.title AS title, v.visit_time AS t FROM history_visits v JOIN history_items i ON i.id = v.history_item ORDER BY v.visit_time DESC LIMIT ?').all(maxVisits) as { url: string; title: string | null; t: number }[]
        for (const r of rows) if (/^https?:\/\//.test(r.url)) visits.push({ url: r.url, title: r.title || r.url, ts: safariTimeToMs(Number(r.t)) })
      } finally { db.close() }
    } catch (e) { if (/Operation not permitted|EPERM|EACCES/i.test(String(e))) denied = true } finally { rmSync(tmp, { recursive: true, force: true }) }
  }
  if (!bookmarks.length && !visits.length && denied) return { ok: false, reason: 'denied' }
  return { ok: true, data: { bookmarks, visits } }
}
