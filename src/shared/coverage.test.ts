import { describe, expect, it } from 'vitest'
import { mergeCss, selectorOfRuleText, summarizeCss, summarizeScripts, usedBytes } from './coverage'

describe('usedBytes', () => {
  it('tek aralik', () => { expect(usedBytes(100, [{ startOffset: 0, endOffset: 100, count: 1 }])).toBe(100); expect(usedBytes(100, [{ startOffset: 0, endOffset: 100, count: 0 }])).toBe(0) })
  it('ic ice: dis calisir, ic fonksiyon calismaz', () => {
    expect(usedBytes(100, [{ startOffset: 0, endOffset: 100, count: 1 }, { startOffset: 20, endOffset: 60, count: 0 }])).toBe(60)
  })
  it('ic ice uc seviye: dis 0, orta 1, en ic 0', () => {
    expect(usedBytes(100, [{ startOffset: 0, endOffset: 100, count: 0 }, { startOffset: 10, endOffset: 90, count: 1 }, { startOffset: 30, endOffset: 50, count: 0 }, { startOffset: 70, endOffset: 80, count: 1 }])).toBe(80 - 20)
  })
  it('kardes aralik ve sinir disina tasan', () => {
    expect(usedBytes(100, [{ startOffset: 0, endOffset: 100, count: 0 }, { startOffset: 10, endOffset: 20, count: 1 }, { startOffset: 30, endOffset: 50, count: 2 }])).toBe(30)
    expect(usedBytes(50, [{ startOffset: 0, endOffset: 80, count: 1 }])).toBe(50); expect(usedBytes(0, [])).toBe(0)
  })
})
describe('summarizeScripts', () => {
  it('url basina toplar, chrome:// ve data: atlar, en cok kullanilmayan once', () => {
    const rows = summarizeScripts([
      { scriptId: '1', url: 'http://a/x.js', functions: [{ ranges: [{ startOffset: 0, endOffset: 1000, count: 1 }, { startOffset: 100, endOffset: 900, count: 0 }] }] },
      { scriptId: '2', url: 'http://a/y.js', functions: [{ ranges: [{ startOffset: 0, endOffset: 200, count: 1 }] }] },
      { scriptId: '3', url: 'chrome-extension://zz/a.js', functions: [{ ranges: [{ startOffset: 0, endOffset: 5, count: 1 }] }] },
      { scriptId: '4', url: '', functions: [] }
    ])
    expect(rows.map((r) => r.url)).toEqual(['http://a/x.js', 'http://a/y.js'])
    expect(rows[0]).toMatchObject({ total: 1000, used: 200, unused: 800, pct: 20 }); expect(rows[1].pct).toBe(100)
  })
})
describe('css', () => {
  it('ozet ve secici', () => {
    expect(summarizeCss([{ styleSheetId: 'a', startOffset: 0, endOffset: 10, used: true }, { styleSheetId: 'a', startOffset: 10, endOffset: 40, used: false }])).toEqual({ rules: 2, used: 1, unused: 1, pct: 50, bytesUnused: 30, bytesTotal: 40 })
    expect(summarizeCss([]).pct).toBe(100)
    expect(selectorOfRuleText('.a  .b,\n.c { color: red }')).toBe('.a .b, .c')
  })
})

describe('mergeCss', () => {
  it('anlik eslesmeyen ama kayit sirasinda kullanilan kural kullanilmis sayilir', () => {
    const snap = [{ sel: '.a', used: true, url: 'inline' }, { sel: '.modal', used: false, url: 'inline' }, { sel: '.never', used: false, url: 'x.css' }]
    const m = mergeCss(snap, ['.modal'])
    expect(m).toMatchObject({ rules: 3, unused: 1, used: 2, pct: 67 }); expect(m.unusedSelectors).toEqual([{ sel: '.never', url: 'x.css' }])
    expect(mergeCss([], [])).toMatchObject({ rules: 0, pct: 100 })
  })
})
