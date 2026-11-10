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
})
