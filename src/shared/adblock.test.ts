import { describe, expect, it } from 'vitest'
import { decide, inSet, siteOf, adPatterns, cdpType, AD_DOMAINS, YOUTUBE_DOC_SCRIPT } from './adblock'

const o = (level: 'off' | 'ads' | 'strict' = 'ads', extra = {}) => ({ level, allow: [] as string[], ...extra })
const P = 'https://news.example.com/article'

describe('decide', () => {
  it('ucuncu taraf reklam alan adlarini engeller (alt alan adlari dahil)', () => {
    expect(decide('https://securepubads.g.doubleclick.net/x.js', 'script', P, o())).toBe('ad')
    expect(decide('https://tpc.googlesyndication.com/a.png', 'image', P, o())).toBe('ad')
  })
  it('ana belgeyi, birinci tarafi ve kapali modu engellemez', () => {
    expect(decide('https://doubleclick.net/', 'mainFrame', P, o())).toBeNull()
    expect(decide('https://ads.example.com/x.js', 'script', P, o())).toBeNull()
    expect(decide('https://doubleclick.net/x', 'script', P, o('off'))).toBeNull()
  })
  it('izleyiciler yalnizca strict modda', () => {
    expect(decide('https://www.google-analytics.com/collect', 'xhr', P, o('ads'))).toBeNull()
    expect(decide('https://www.google-analytics.com/collect', 'xhr', P, o('strict'))).toBe('tracker')
  })
  it('gelistirme (loopback) sayfalarina dokunmaz; blockOnDev ile acilir', () => {
    expect(decide('https://doubleclick.net/x', 'script', 'http://localhost:5173/', o())).toBeNull()
    expect(decide('https://doubleclick.net/x', 'script', 'http://localhost:5173/', o('ads', { blockOnDev: true }))).toBe('ad')
  })
  it('site bazli izin listesi', () => {
    expect(decide('https://doubleclick.net/x', 'script', P, o('ads', { allow: ['example.com'] }))).toBeNull()
  })
  it('yol kalibi yalnizca ucuncu tarafta ve script/gorsel/xhr/frame tipinde', () => {
    expect(decide('https://cdn.other.com/pagead/js/x.js', 'script', P, o())).toBe('ad')
    expect(decide('https://cdn.other.com/pagead/style.css', 'stylesheet', P, o())).toBeNull()
  })
  it('YouTube reklam uc noktalari', () => {
    expect(decide('https://www.youtube.com/pagead/adview?x=1', 'xhr', 'https://www.youtube.com/watch?v=1', o())).toBe('youtube')
    expect(decide('https://www.youtube.com/api/stats/ads?x', 'image', 'https://www.youtube.com/watch?v=1', o())).toBe('youtube')
    expect(decide('https://www.youtube.com/youtubei/v1/player', 'xhr', 'https://www.youtube.com/watch?v=1', o())).toBeNull()
  })
})
describe('yardimcilar', () => {
  it('inSet ust alan adlarini dener, siteOf ikinci duzey eki taniyor', () => {
    expect(inSet('a.b.criteo.com', AD_DOMAINS)).toBe(true); expect(inSet('notcriteo.com', AD_DOMAINS)).toBe(false)
    expect(siteOf('www.hepsiburada.com')).toBe('hepsiburada.com'); expect(siteOf('shop.example.com.tr')).toBe('example.com.tr')
  })
})

describe('adPatterns / cdpType', () => {
  it('kapali modda kalip yok; ads yalniz reklam, strict izleyici de icerir; her alan adi iki kalip', () => {
    expect(adPatterns('off')).toEqual([])
    const ads = adPatterns('ads').map((x) => x.urlPattern), strict = adPatterns('strict').map((x) => x.urlPattern)
    expect(ads).toContain('*://*.doubleclick.net/*'); expect(ads).toContain('*://doubleclick.net/*'); expect(ads).not.toContain('*://*.google-analytics.com/*')
    expect(strict).toContain('*://*.google-analytics.com/*'); expect(ads).toContain('*://*.youtube.com/api/stats/ads*')
    expect(ads.length).toBeLessThan(600)
  })
  it('CDP turlerini cevirir', () => {
    expect(cdpType('Script', false)).toBe('script'); expect(cdpType('Fetch', false)).toBe('xhr')
    expect(cdpType('Document', true)).toBe('mainFrame'); expect(cdpType('Document', false)).toBe('subFrame')
  })
})

describe('YOUTUBE_DOC_SCRIPT', () => {
  const run = (host: string) => {
    const win: Record<string, unknown> = {}
    const Resp = function () {} as unknown as { prototype: { json: () => Promise<unknown>; url?: string } }
    Resp.prototype.json = function () { return Promise.resolve({ adPlacements: [1], playerAds: [2], videoDetails: { a: 1 }, nested: { adSlots: [3], keep: 1 } }) }
    const J = { parse: (t: string) => JSON.parse(t) }
    new Function('window', 'location', 'Response', 'JSON', YOUTUBE_DOC_SCRIPT)(win, { hostname: host }, Resp, J)
    return { win, Resp, J }
  }
  it('ilk yukleme JSON atamasindaki reklam alanlarini siler, digerlerini korur', () => {
    const { win } = run('www.youtube.com')
    win.ytInitialPlayerResponse = { adPlacements: [{ x: 1 }], playerAds: [1], videoDetails: { title: 't' }, streamingData: { adaptiveFormats: [] } }
    const v = win.ytInitialPlayerResponse as Record<string, unknown>
    expect(v.adPlacements).toBeUndefined(); expect(v.playerAds).toBeUndefined(); expect(v.videoDetails).toEqual({ title: 't' }); expect(v.streamingData).toBeDefined()
  })
  it('player yanitlarinin json() ve buyuk JSON.parse sonucunu temizler; diger url dokunulmaz', async () => {
    const { Resp, J } = run('m.youtube.com')
    const r = new (Resp as unknown as new () => { url: string; json: () => Promise<any> })(); r.url = 'https://www.youtube.com/youtubei/v1/player?key=1'
    const j = await r.json(); expect(j.adPlacements).toBeUndefined(); expect(j.nested.adSlots).toBeUndefined(); expect(j.nested.keep).toBe(1)
    const r2 = new (Resp as unknown as new () => { url: string; json: () => Promise<any> })(); r2.url = 'https://www.youtube.com/youtubei/v1/browse'
    expect((await r2.json()).adPlacements).toBeDefined()
    const big = JSON.stringify({ adPlacements: [1], pad: 'x'.repeat(1200), ok: 1 })
    const p = J.parse(big) as Record<string, unknown>; expect(p.adPlacements).toBeUndefined(); expect(p.ok).toBe(1)
  })
  it('YouTube disinda hicbir sey yapmaz', () => {
    const { win } = run('example.com'); win.ytInitialPlayerResponse = { adPlacements: [1] }
    expect((win.ytInitialPlayerResponse as Record<string, unknown>).adPlacements).toBeDefined()
  })
})
