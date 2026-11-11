import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import { readSafariProfile } from './importer-safari'
import { parseSafariBookmarks, safariTimeToMs } from '../shared/importsafari'
import { parseLaunch } from './launch'

const PLIST = `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Children</key><array>
<dict><key>Title</key><string>BookmarksBar</string><key>WebBookmarkType</key><string>WebBookmarkTypeList</string><key>Children</key><array>
<dict><key>URIDictionary</key><dict><key>title</key><string>Apple</string></dict><key>URLString</key><string>https://apple.com/</string><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string></dict>
<dict><key>URIDictionary</key><dict><key>title</key><string>Ayar</string></dict><key>URLString</key><string>x-apple.systempreferences:foo</string><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string></dict>
</array></dict></array><key>WebBookmarkType</key><string>WebBookmarkTypeList</string></dict></plist>`

describe('Safari ice aktarma', () => {
  it('yer imi agacini ve zamani cevirir', () => {
    expect(parseSafariBookmarks({ Children: [{ WebBookmarkType: 'WebBookmarkTypeLeaf', URLString: 'https://a.com', URIDictionary: { title: 'A' } }, { WebBookmarkType: 'WebBookmarkTypeLeaf', URLString: 'ftp://x' }] })).toEqual([{ url: 'https://a.com', title: 'A' }])
    expect(safariTimeToMs(0)).toBe(978_307_200_000)
  })
  it.skipIf(process.platform !== 'darwin')('plist + History.db okur (plutil ile; yalniz macOS)', () => {
    const dir = mkdtempSync(join(tmpdir(), 'saf-'))
    writeFileSync(join(dir, 'Bookmarks.plist'), PLIST)
    const db = new DatabaseSync(join(dir, 'History.db'))
    db.exec('CREATE TABLE history_items (id INTEGER PRIMARY KEY, url TEXT); CREATE TABLE history_visits (id INTEGER PRIMARY KEY, history_item INTEGER, visit_time REAL, title TEXT)')
    db.prepare('INSERT INTO history_items VALUES (1, ?)').run('https://x.com/p'); db.prepare('INSERT INTO history_items VALUES (2, ?)').run('file:///etc')
    db.prepare('INSERT INTO history_visits (history_item, visit_time, title) VALUES (1, ?, ?)').run(700_000_000.5, 'X'); db.prepare('INSERT INTO history_visits (history_item, visit_time, title) VALUES (2, ?, ?)').run(700_000_001, 'F')
    db.close()
    const r = readSafariProfile(dir)
    expect(r.ok).toBe(true)
    if (r.ok) { expect(r.data.bookmarks).toEqual([{ url: 'https://apple.com/', title: 'Apple' }]); expect(r.data.visits.map((v) => v.url)).toEqual(['https://x.com/p']) }
  })
  it('olmayan klasor missing doner', () => { expect(readSafariProfile('/tmp/yok-safari-' + Date.now())).toEqual({ ok: false, reason: 'missing' }) })
})

describe('parseLaunch http(s)', () => {
  it('sistemden gelen http(s) baglantisini url olarak acar, bozuk/diger semayi yok sayar', () => {
    expect(parseLaunch(['https://example.com/a?b=1'])).toEqual({ type: 'url', url: 'https://example.com/a?b=1' })
    expect(parseLaunch(['ftp://x', 'file:///etc/passwd'])).toBeNull()
  })
})
