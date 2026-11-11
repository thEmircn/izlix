import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { decryptPayload, encryptPayload, SyncService, SYNC_FILE } from './sync'
import type { SyncPayload } from '../shared/sync'

const P: SyncPayload = { v: 1, ts: 5, device: 'd', bookmarks: { W: [{ url: 'https://x.com', title: 'X', ts: 1 }] }, notes: [], sites: {}, settings: { language: 'tr' } }

describe('sync sifreleme', () => {
  it('gidis-donus, dosyada acik metin yok', () => {
    const e = encryptPayload(P, 'parola')
    expect(e).not.toContain('x.com'); expect(decryptPayload(e, 'parola')).toEqual(P)
  })
  it('yanlis parola ve bozuk dosya reddedilir', () => {
    const e = encryptPayload(P, 'parola')
    expect(() => decryptPayload(e, 'yanlis')).toThrow('bad-pass')
    expect(() => decryptPayload('{bozuk', 'parola')).toThrow('corrupt')
    const t = JSON.parse(e); t.data = Buffer.from('zz').toString('base64')
    expect(() => decryptPayload(JSON.stringify(t), 'parola')).toThrow('bad-pass')
  })
  it('iki cihaz: birinin yazdigini digeri alir', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sync-'))
    const got: SyncPayload[] = []
    const a = new SyncService({ build: () => P, apply: () => {}, pass: () => 'p', dir: () => dir })
    const b = new SyncService({ build: () => ({ ...P, device: 'b' }), apply: (r) => got.push(r), pass: () => 'p', dir: () => dir })
    expect(a.run()).toMatchObject({ ok: true, pulled: false })
    expect(b.run()).toMatchObject({ ok: true, pulled: true }); expect(got[0].bookmarks.W[0].url).toBe('https://x.com')
  })
  it('parola yok / yanlis parola', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sync-'))
    expect(new SyncService({ build: () => P, apply: () => {}, pass: () => null, dir: () => dir }).run().error).toBe('no-pass')
    new SyncService({ build: () => P, apply: () => {}, pass: () => 'p', dir: () => dir }).run()
    expect(new SyncService({ build: () => P, apply: () => {}, pass: () => 'q', dir: () => dir }).run().error).toBe('bad-pass')
    writeFileSync(join(dir, SYNC_FILE), 'cop')
    expect(new SyncService({ build: () => P, apply: () => {}, pass: () => 'p', dir: () => dir }).run().error).toBe('corrupt')
    expect(readFileSync(join(dir, SYNC_FILE), 'utf8')).toBe('cop') // bozuk dosyanin ustune yazmaz
  })
})
