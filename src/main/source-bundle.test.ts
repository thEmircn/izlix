import { describe, expect, it } from 'vitest'
import { loadBundle, parseMap } from './source-bundle'

describe('parseMap', () => {
  it('duz harita: sourceRoot ve icerik', () => {
    const r = parseMap(JSON.stringify({ version: 3, sourceRoot: 'src', sources: ['a.ts', 'webpack://app/./b.ts?x', 'file:///p/c.ts'], sourcesContent: ['A', null, 'C'] }))
    expect(r).toEqual([{ name: 'src/a.ts', content: 'A' }, { name: './b.ts', content: null }, { name: '/p/c.ts', content: 'C' }])
  })
  it('bolumlu (Turbopack) harita; tekrarlar elenir; bozuk girdi bos', () => {
    const r = parseMap(JSON.stringify({ version: 3, sections: [{ offset: {}, map: { sources: ['file:///p/page.js'], sourcesContent: ['x'] } }, { offset: {}, map: { sources: ['file:///p/page.js'], sourcesContent: ['x'] } }] }))
    expect(r).toEqual([{ name: '/p/page.js', content: 'x' }]); expect(parseMap('nope')).toEqual([])
  })
})
describe('loadBundle', () => {
  it('harita yoksa yalniz kod', async () => {
    const b = await loadBundle(async () => 'console.log(1)', 'http://a/x.js'); expect(b.sources).toEqual([]); expect(b.code).toBe('console.log(1)')
  })
  it('sourceMappingURL izlenir (goreli); gomulu icerik doner', async () => {
    const files: Record<string, string> = { 'http://a/js/x.js': 'code\n//# sourceMappingURL=x.js.map', 'http://a/js/x.js.map': JSON.stringify({ sources: ['../src/a.ts'], sourcesContent: ['const a = 1'] }) }
    const b = await loadBundle(async (u) => files[u] ?? null, 'http://a/js/x.js')
    expect(b.mapUrl).toBe('http://a/js/x.js.map'); expect(b.sources).toEqual([{ name: '../src/a.ts', content: 'const a = 1' }])
  })
  it('cok uzun satir ici harita (600+ karakter) bulunur; CSS yorum bicimi; ilgisiz metin yok sayilir', async () => {
    const big = Buffer.from(JSON.stringify({ sources: ['a.ts'], sourcesContent: ['x'.repeat(5000)] })).toString('base64')
    const b = await loadBundle(async () => `c\n//# sourceMappingURL=data:application/json;base64,${big}`, 'http://a/x.js')
    expect(b.sources[0].name).toBe('a.ts'); expect(b.sources[0].content!.length).toBe(5000)
    const css = await loadBundle(async (u) => (u.endsWith('.map') ? JSON.stringify({ sources: ['s.scss'], sourcesContent: ['a{}'] }) : 'a{}\n/*# sourceMappingURL=x.css.map */'), 'http://a/x.css')
    expect(css.sources[0].name).toBe('s.scss')
    expect((await loadBundle(async () => 'var s = "sourceMappingURL=oops"', 'http://a/y.js')).sources).toEqual([])
  })
  it('satir ici (data:) harita', async () => {
    const map = Buffer.from(JSON.stringify({ sources: ['a.ts'], sourcesContent: ['x'] })).toString('base64')
    const b = await loadBundle(async () => `c\n//# sourceMappingURL=data:application/json;base64,${map}`, 'http://a/x.js')
    expect(b.mapUrl).toBe('inline'); expect(b.sources[0]).toEqual({ name: 'a.ts', content: 'x' })
  })
})
