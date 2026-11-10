import { describe, expect, it } from 'vitest'
import { groupHits, searchFiles } from './srcsearch'

const files = [
  { name: 'src/App.tsx', text: 'import x from "y"\nfunction loadItems() {\n  fetch("/api/items")\n}\n' },
  { name: 'src/util.ts', text: 'export const a = 1\nexport function LOADER() {}\n' }
]
describe('searchFiles', () => {
  it('buyuk/kucuk harf duyarsiz, satir ve sutun dogru, dosyalara gore', () => {
    const h = searchFiles(files, 'load')
    expect(h.map((x) => `${x.file}:${x.line}:${x.col}`)).toEqual(['src/App.tsx:2:10', 'src/util.ts:2:17'])
    expect(groupHits(h).map((g) => g.file)).toEqual(['src/App.tsx', 'src/util.ts'])
  })
  it('kisa sorgu bos doner; sinirlar uygulanir', () => {
    expect(searchFiles(files, 'a')).toEqual([])
    const many = [{ name: 'm.js', text: Array.from({ length: 100 }, () => 'foo').join('\n') }]
    expect(searchFiles(many, 'foo', { perFile: 5 })).toHaveLength(5); expect(searchFiles(many, 'foo', { total: 7, perFile: 50 })).toHaveLength(7)
  })
  it('cok uzun satirda eslesme etrafi kesilir', () => {
    const long = [{ name: 'min.js', text: 'a'.repeat(500) + 'NEEDLE' + 'b'.repeat(500) }]
    const h = searchFiles(long, 'needle')[0]
    expect(h.snippet.length).toBeLessThan(160); expect(h.snippet).toContain('NEEDLE'); expect(h.col).toBe(501)
  })
})
