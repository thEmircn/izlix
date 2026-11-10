import { describe, expect, it } from 'vitest'
import { highlightLine, initState, langOf } from './highlight'

const kinds = (s: string, lang: 'js' | 'css' | 'json' | 'text' = 'js'): string => highlightLine(s, initState(), lang).map((t) => `${t.t}:${t.s}`).join('|')
describe('highlightLine', () => {
  it('anahtar kelime, fonksiyon cagrisi, string, sayi', () => {
    expect(kinds("const x = foo(42, 'a')")).toBe("kw:const|plain: x = |fn:foo|plain:(|num:42|plain:, |str:'a'|plain:)")
  })
  it('satir yorumu ve satir sonu', () => { expect(kinds('a(); // not')).toBe('fn:a|plain:(); |com:// not') })
  it('blok yorum satirlar arasi surer', () => {
    const st = initState()
    expect(highlightLine('x /* basla', st, 'js').map((t) => t.t)).toEqual(['plain', 'com']); expect(st.block).toBe(true)
    expect(highlightLine('hala yorum */ y', st, 'js').map((t) => t.t)).toEqual(['com', 'plain']); expect(st.block).toBe(false)
  })
  it('kacis karakteri string icinde; eksik string satir sonuna kadar', () => {
    expect(kinds("'it\\'s' + 1")).toBe("str:'it\\'s'|plain: + |num:1"); expect(kinds("'acik")).toBe("str:'acik")
  })
  it('json yorum tanimaz; css @kurali; cok uzun satir duz', () => {
    expect(kinds('"a": 1 // x', 'json')).toContain('num:1'); expect(kinds('@media (x)', 'css')).toBe('kw:@media|plain: (x)')
    expect(highlightLine('x'.repeat(2500), initState())).toHaveLength(1)
  })
  it('sayi baska kelimenin parcasi degil; langOf', () => {
    expect(kinds('abc123 + 7')).toBe('plain:abc123 + |num:7')
    expect(langOf('a/b.tsx?t=1')).toBe('js'); expect(langOf('x.css')).toBe('css'); expect(langOf('x.js.map')).toBe('json'); expect(langOf('index.html')).toBe('text')
  })
})
