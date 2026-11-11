import { describe, expect, it } from 'vitest'
import { matchesTitle, rankTabs, searchText } from './tabsearch'
describe('tabsearch', () => {
  it('searchText: sayim, ozet, bosluk normallestirme, sinirlar', () => {
    const r = searchText('Bir elma\n\n  ve bir ELMA daha; elma!', 'elma', 2)
    expect(r.count).toBe(3); expect(r.snippets).toHaveLength(2); expect(r.snippets[0]).toContain('Bir elma ve bir ELMA')
    expect(searchText('abc', '').count).toBe(0); expect(searchText('abc', 'zzz').count).toBe(0)
  })
  it('Turkce buyuk/kucuk harf: I/ı ve İ/i', () => {
    expect(searchText('ISPARTA ışık', 'ısparta').count).toBe(1); expect(searchText('İstanbul', 'istanbul').count).toBe(1); expect(searchText('IŞIK', 'ışık').count).toBe(1)
  })
  it('uzun metinde ozetler kesik isaretli', () => {
    const t = 'x'.repeat(200) + ' hedef ' + 'y'.repeat(200); const r = searchText(t, 'hedef')
    expect(r.snippets[0].startsWith('…') && r.snippets[0].endsWith('…')).toBe(true); expect(r.snippets[0].length).toBeLessThan(120)
  })
  it('rankTabs ve matchesTitle', () => {
    const h = (id: string, title: string, count: number, titleMatch: boolean) => ({ id, title, url: '', count, snippets: [], titleMatch })
    expect(rankTabs([h('a', 'B', 1, false), h('b', 'A', 5, false), h('c', 'C', 1, true)]).map((x) => x.id)).toEqual(['b', 'c', 'a'])
    expect(matchesTitle('Alfa', 'http://x/beta', 'BET')).toBe(true); expect(matchesTitle('Alfa', 'u', '')).toBe(true); expect(matchesTitle('Alfa', 'u', 'zz')).toBe(false)
  })
})
