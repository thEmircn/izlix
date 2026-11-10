import { describe, expect, it } from 'vitest'
import { evaluateSeo, scoreOf, type SeoData } from './seo'

const base: SeoData = {
  url: 'http://a.com', title: 'A good page title here', description: 'x'.repeat(100), canonical: 'http://a.com', robots: null, viewport: 'width=device-width', lang: 'en', charset: 'UTF-8',
  og: { 'og:title': 't', 'og:description': 'd', 'og:image': 'i' }, twitter: { 'twitter:card': 'summary' }, jsonld: [{ type: 'Article', ok: true }], h1: ['Hi'], icon: true, links: { total: 5, internal: 4, external: 1, nofollow: 0 }, images: { total: 2, noAlt: 0 }
}
const ids = (d: SeoData): string[] => evaluateSeo(d).filter((i) => i.sev !== 'ok').map((i) => i.id)
describe('evaluateSeo', () => {
  it('eksiksiz sayfa uyarisiz, skor 100', () => { expect(ids(base)).toEqual([]); expect(scoreOf(evaluateSeo(base))).toBe(100) })
  it('baslik/aciklama uzunluk kurallari', () => {
    expect(ids({ ...base, title: '' })).toContain('title.missing'); expect(ids({ ...base, title: 'short' })).toContain('title.short'); expect(ids({ ...base, title: 'x'.repeat(61) })).toContain('title.long')
    expect(ids({ ...base, description: null })).toContain('desc.missing'); expect(ids({ ...base, description: 'x'.repeat(20) })).toContain('desc.short'); expect(ids({ ...base, description: 'x'.repeat(170) })).toContain('desc.long')
  })
  it('h1, og, twitter, lang, viewport, noindex, jsonld, icon, alt', () => {
    const bad = ids({ ...base, h1: [], og: {}, twitter: {}, lang: null, viewport: null, robots: 'noindex,follow', jsonld: [{ type: 'invalid JSON', ok: false }], icon: false, images: { total: 3, noAlt: 2 }, canonical: null })
    for (const id of ['h1.missing', 'og.title.missing', 'og.description.missing', 'og.image.missing', 'twitter.missing', 'lang.missing', 'viewport.missing', 'robots.noindex', 'jsonld.invalid', 'icon.missing', 'img.alt', 'canonical.missing']) expect(bad).toContain(id)
    expect(ids({ ...base, h1: ['a', 'b'] })).toContain('h1.multiple')
  })
  it('skor hatalar 15, uyarilar 5 dusurur; 0 altina inmez', () => {
    expect(scoreOf([{ id: 'a', sev: 'error' }, { id: 'b', sev: 'warn' }])).toBe(80)
    expect(scoreOf(Array.from({ length: 20 }, () => ({ id: 'x', sev: 'error' as const })))).toBe(0)
  })
})
