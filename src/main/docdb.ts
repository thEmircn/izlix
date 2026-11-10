import { DatabaseSync } from 'node:sqlite'
import { existsSync, mkdirSync, readFileSync, renameSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Yerel depo (plan K-09): tum kalici belgeler (workspaces, rules, library, settings, permissions, sessions, window, session) tek bir SQLite
 * dosyasinda (`izlix.db`, WAL) belge olarak saklanir. Native modul yok: Node'un yerlesik `node:sqlite`'i.
 * Eski `<ad>.json` dosyalari ilk okumada otomatik iceri aktarilir ve `<ad>.json.migrated` olarak yedeklenir.
 */
const dbs = new Map<string, DatabaseSync>()

function open(dir: string): DatabaseSync {
  const hit = dbs.get(dir); if (hit) return hit
  mkdirSync(dir, { recursive: true })
  const db = new DatabaseSync(join(dir, 'izlix.db'))
  db.exec('PRAGMA journal_mode = WAL; PRAGMA synchronous = NORMAL; CREATE TABLE IF NOT EXISTS docs (name TEXT PRIMARY KEY, json TEXT NOT NULL, updated INTEGER NOT NULL)')
  dbs.set(dir, db); return db
}

/** Belgeyi okur; yoksa eski JSON dosyasini iceri aktarir; o da yoksa undefined. */
export function loadDoc<T>(dir: string, name: string): T | undefined {
  const db = open(dir)
  const row = db.prepare('SELECT json FROM docs WHERE name = ?').get(name) as { json: string } | undefined
  if (row) { try { return JSON.parse(row.json) as T } catch { return undefined } }
  const legacy = join(dir, `${name}.json`)
  if (existsSync(legacy)) {
    try {
      const v = JSON.parse(readFileSync(legacy, 'utf8')) as T
      saveDoc(dir, name, v); renameSync(legacy, `${legacy}.migrated`)
      return v
    } catch { /* bozuk eski dosya: yok say */ }
  }
  return undefined
}

/** Belgeyi atomik olarak yazar (SQLite islemi). Hata firlatmaz: disk sorunu bellekteki durumu bozmaz. */
export function saveDoc(dir: string, name: string, value: unknown): boolean {
  try {
    open(dir).prepare('INSERT INTO docs (name, json, updated) VALUES (?, ?, ?) ON CONFLICT(name) DO UPDATE SET json = excluded.json, updated = excluded.updated').run(name, JSON.stringify(value), Date.now())
    return true
  } catch { return false }
}

export function deleteDoc(dir: string, name: string): void { try { open(dir).prepare('DELETE FROM docs WHERE name = ?').run(name) } catch { /* yok say */ } }
export function listDocs(dir: string): { name: string; updated: number; bytes: number }[] {
  return (open(dir).prepare('SELECT name, updated, length(json) AS bytes FROM docs ORDER BY name').all() as { name: string; updated: number; bytes: number }[])
}
/** Test/kapanis: acik baglantilari kapatir (WAL'i dosyaya isler). */
export function closeDocDbs(): void { for (const db of dbs.values()) { try { db.close() } catch { /* yok say */ } } dbs.clear() }
