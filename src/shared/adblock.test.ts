import { describe, expect, it } from 'vitest'
import { decide, inSet, siteOf, AD_DOMAINS } from './adblock'

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
