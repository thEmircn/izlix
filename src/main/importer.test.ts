import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readChromeProfile } from './importer'
import { Library } from './library'
import { chromeTimeToMs, parseChromeBookmarks } from '../shared/importchrome'

describe('Chrome ice aktarma', () => {
  it('yer imi agacini duzlestirir; yalniz http(s), tekrarsiz', () => {
    const j = { roots: { bookmark_bar: { children: [{ type: 'url', url: 'https://a.com', name: 'A' }, { type: 'folder', children: [{ type: 'url', url: 'https://b.com', name: 'B' }, { type: 'url', url: 'https://a.com', name: 'A2' }] }] }, other: { children: [{ type: 'url', url: 'chrome://settings', name: 'S' }] } } }
    expect(parseChromeBookmarks(j)).toEqual([{ url: 'https://a.com', title: 'A' }, { url: 'https://b.com', title: 'B' }])
    expect(parseChromeBookmarks(null)).toEqual([])
  })
  it('Chrome zamanini epoch ms yapar', () => { expect(chromeTimeToMs(13_300_000_000_000_000)).toBe(Math.round(13_300_000_000_000 - 11_644_473_600_000)) })
  it('profilden yer imi ve gecmisi okur, kayit yoksa null', () => {
    const dir = mkdtempSync(join(tmpdir(), 'chr-'))
    expect(readChromeProfile(dir)).toBeNull()
    writeFileSync(join(dir, 'Bookmarks'), JSON.stringify({ roots: { bookmark_bar: { children: [{ type: 'url', url: 'https://a.com', name: 'A' }] } } }))
    const db = new DatabaseSync(join(dir, 'History'))
    db.exec('CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_time INTEGER)')
    const ins = db.prepare('INSERT INTO urls (url,title,last_visit_time) VALUES (?,?,?)')
    ins.run('https://x.com/p', 'X', 13_300_000_000_000_000); ins.run('chrome://newtab', 'N', 13_300_000_000_000_001); ins.run('https://y.com', '', 13_300_000_100_000_000)
    db.close()
    const r = readChromeProfile(dir)!
    expect(r.bookmarks).toHaveLength(1)
    expect(r.visits.map((v) => v.url)).toEqual(['https://y.com', 'https://x.com/p']) // en yeni once, chrome:// yok
    expect(r.visits[0].title).toBe('https://y.com')
  })
  it('Library.importData tekrarlari atlar, ikinci aktarma 0 ekler', () => {
    const l = new Library(mkdtempSync(join(tmpdir(), 'lib-')))
    const bm = [{ url: 'https://a.com', title: 'A' }], vs = [{ url: 'https://x.com', title: 'X', ts: 1_700_000_000_000 }]
    expect(l.importData('default', bm, vs)).toEqual({ bookmarks: 1, history: 1 })
    expect(l.importData('default', bm, vs)).toEqual({ bookmarks: 0, history: 0 })
    expect(l.recent().map((v) => v.url)).toEqual(['https://x.com'])
  })
})
