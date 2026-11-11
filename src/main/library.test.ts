import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Library } from './library'

const lib = (): Library => new Library(mkdtempSync(join(tmpdir(), 'lib-')))
describe('Library', () => {
  it('yalnizca http(s) kaydeder, URL basina tek kayit doner, en yeni once', () => {
    const l = lib()
    l.addVisit('about:blank', 'x', 1); l.addVisit('https://a.com', 'A', 2); l.addVisit('https://b.com', 'B', 3); l.addVisit('https://a.com', 'A2', 4)
    expect(l.recent().map((v) => v.url)).toEqual(['https://a.com', 'https://b.com'])
  })
  it('ayni sayfada baslik guncellemesi yeni kayit acmaz', () => {
    const l = lib(); l.addVisit('https://a.com', '', 1); l.addVisit('https://a.com', 'Baslik', 2)
    expect(l.recent()).toHaveLength(1); expect(l.recent()[0].title).toBe('Baslik')
  })
  it('yer imi ac/kapa Workspace basina ayri', () => {
    const l = lib()
    expect(l.toggleBookmark('w1', 'https://a.com', 'A')).toBe(true)
    expect(l.isBookmarked('w1', 'https://a.com')).toBe(true)
    expect(l.isBookmarked('w2', 'https://a.com')).toBe(false)
    expect(l.toggleBookmark('w1', 'https://a.com', 'A')).toBe(false)
    expect(l.toggleBookmark('w1', 'file:///x', 'x')).toBe(false)
  })
  it('gecmis siniri', () => {
    const l = lib(); for (let i = 0; i < 5100; i++) l.addVisit('https://x.com/' + i, '', i)
    expect(l.recent(10000)).toHaveLength(5000)
  })
  it('gecmis sayfasi: ziyaretler en yeni once, arama, tek ziyaret/adres silme, zamana gore temizleme', () => {
    const l = lib()
    l.addVisit('https://a.com/', 'Elma', 1000); l.addVisit('https://b.com/', 'Armut', 2000); l.addVisit('https://a.com/', 'Elma', 3000); l.addVisit('https://c.com/', 'Kiraz', 4000)
    expect(l.visits().map((v) => v.ts)).toEqual([4000, 3000, 2000, 1000])
    expect(l.visits('elma').map((v) => v.ts)).toEqual([3000, 1000]); expect(l.visits('', 2)).toHaveLength(2)
    expect(l.removeVisits('https://a.com/', 3000)).toBe(1); expect(l.visits('elma').map((v) => v.ts)).toEqual([1000])
    expect(l.removeVisits('https://a.com/')).toBe(1)
    expect(l.clearSince(3000)).toBe(1); expect(l.visits().map((v) => v.ts)).toEqual([2000])
    expect(l.clearSince(0)).toBe(1); expect(l.visits()).toEqual([])
  })
  it('yer imi duzenleme: baslik/url/klasor, silme, klasor yeniden adlandirma/silme', () => {
    const l = lib()
    l.toggleBookmark('w', 'https://a.com/', 'A', 1); l.toggleBookmark('w', 'https://b.com/', 'B', 2)
    expect(l.updateBookmark('w', 'https://a.com/', { title: 'Alfa', folder: 'Is' })).toBe(true)
    expect(l.updateBookmark('w', 'https://b.com/', { folder: 'Is', url: 'https://a.com/' })).toBe(true) // ayni url baska yer iminde var: url degismez
    expect(l.bookmarks('w').map((b) => [b.url, b.title, b.folder])).toEqual([['https://a.com/', 'Alfa', 'Is'], ['https://b.com/', 'B', 'Is']])
    expect(l.folders('w')).toEqual(['Is']); expect(l.editFolder('w', 'Is', 'Is2')).toBe(2); expect(l.folders('w')).toEqual(['Is2'])
    expect(l.editFolder('w', 'Is2')).toBe(2); expect(l.folders('w')).toEqual([])
    expect(l.removeBookmark('w', 'https://a.com/')).toBe(true); expect(l.removeBookmark('w', 'https://yok/')).toBe(false); expect(l.bookmarks('w')).toHaveLength(1)
    expect(l.updateBookmark('w', 'https://b.com/', { url: 'javascript:alert(1)' })).toBe(true); expect(l.bookmarks('w')[0].url).toBe('https://b.com/')
  })
})
