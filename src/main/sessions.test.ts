import { describe, expect, it, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
vi.mock('electron', () => ({ app: { getPath: () => tmpdir() } }))
import { SessionStore } from './sessions'

const mk = (): SessionStore => new SessionStore(mkdtempSync(join(tmpdir(), 'sess-')))
const tabs = [{ url: 'http://localhost:5173/', title: 'App' }, { url: 'https://example.com/', title: 'Ex' }, { url: 'file:///etc/passwd', title: 'x' }, { url: 'about:blank', title: '' }]

describe('SessionStore', () => {
  it('yalnizca http(s) sekmeleri saklanir; indeksler sinirlanir', () => {
    const s = mk(); const r = s.add('w', 'Gunluk', tabs, 9, [0, 7], 1000)!
    expect(r.tabs.map((t) => t.url)).toEqual(['http://localhost:5173/', 'https://example.com/']); expect(r.active).toBe(1); expect(r.split).toBeNull()
  })
  it('ayni ad ustune yazar, listeler yeni once, siler', () => {
    const s = mk()
    s.add('w', 'A', tabs, 0, null, 1000); s.add('w', 'B', tabs, 0, [0, 1], 2000); const a2 = s.add('w', 'A', tabs.slice(0, 1), 0, null, 3000)!
    expect(s.list('w').map((x) => x.name)).toEqual(['A', 'B']); expect(s.list('w')[0].tabs).toHaveLength(1)
    expect(s.list('w')[1].split).toEqual([0, 1])
    expect(s.remove('w', a2.id)).toBe(true); expect(s.remove('w', 'nope')).toBe(false); expect(s.list('w').map((x) => x.name)).toEqual(['B'])
  })
  it('sekmesiz oturum kaydedilmez; Workspace baska Workspace ile karismaz', () => {
    const s = mk(); expect(s.add('w', 'X', [{ url: 'file:///x', title: '' }], 0, null)).toBeNull()
    s.add('w1', 'A', tabs, 0, null); expect(s.list('w2')).toEqual([])
  })
  it('diske yazilir ve yeniden okunur', () => {
    const dir = mkdtempSync(join(tmpdir(), 'sess-')); const a = new SessionStore(dir); a.add('w', 'Keep', tabs, 0, null, 5)
    expect(new SessionStore(dir).list('w')[0].name).toBe('Keep')
  })
})
