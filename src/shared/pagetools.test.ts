import { describe, expect, it } from 'vitest'
import { auditImages, brokenLinks, type ImgRow } from './pagetools'

const img = (o: Partial<ImgRow>): ImgRow => ({ src: 'http://a/x.png', nw: 800, nh: 600, dw: 400, dh: 300, bytes: 50000, lazy: false, inView: true, hasDims: true, dpr: 1, ...o })
describe('brokenLinks', () => { it('0 ve >=400 kirik; 3xx/2xx degil; once en buyuk durum', () => {
  expect(brokenLinks([{ url: 'a', status: 200 }, { url: 'b', status: 404 }, { url: 'c', status: 0 }, { url: 'd', status: 500 }, { url: 'e', status: 301 }]).map((x) => x.url)).toEqual(['d', 'b', 'c'])
}) })
describe('auditImages', () => {
  it('sorunsuz gorsel listelenmez', () => { expect(auditImages([img({})])).toEqual([]) })
  it('gereginden buyuk: dogal > 2x goruntulenen*dpr; israf hesabi', () => {
    const r = auditImages([img({ nw: 2000, dw: 400, bytes: 400 * 1024 })])
    expect(r[0].issues).toContain('oversized'); expect(r[0].issues).toContain('heavy'); expect(r[0].wasteKb).toBeGreaterThan(300)
    expect(auditImages([img({ nw: 800, dw: 400, dpr: 2 })])).toEqual([]) // retina: 800 gerekli
  })
  it('ekran disi lazy olmayan, boyutsuz, kirik; data: atlanir', () => {
    expect(auditImages([img({ inView: false })])[0].issues).toEqual(['no-lazy']); expect(auditImages([img({ inView: false, lazy: true })])).toEqual([])
    expect(auditImages([img({ hasDims: false })])[0].issues).toEqual(['no-dims'])
    expect(auditImages([img({ nw: 0, nh: 0 })])[0].issues).toEqual(['broken'])
    expect(auditImages([img({ src: 'data:image/png;base64,xx', nw: 5000 })])).toEqual([])
  })
  it('israfa gore siralar', () => {
    const r = auditImages([img({ src: 'a', nw: 1000, bytes: 100 * 1024 }), img({ src: 'b', nw: 4000, bytes: 900 * 1024 })])
    expect(r[0].src).toBe('b')
  })
})
