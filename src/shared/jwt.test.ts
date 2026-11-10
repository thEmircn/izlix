import { describe, expect, it } from 'vitest'
import { decodeJwt, expiryOf, findJwts, humanDelta } from './jwt'

const enc = (o: object): string => Buffer.from(JSON.stringify(o)).toString('base64url')
const mk = (payload: object): string => `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(payload)}.sig`
describe('jwt', () => {
  it('cozer; exp/iat/nbf sayilarini ayiklar; UTF-8 yuk', () => {
    const j = decodeJwt(mk({ sub: 'çağrı', exp: 2000000000, iat: 1700000000 }))!
    expect(j.header.alg).toBe('HS256'); expect(j.payload.sub).toBe('çağrı'); expect(j.exp).toBe(2000000000); expect(j.iat).toBe(1700000000)
  })
  it('gecersizler null', () => { for (const t of ['abc', 'a.b.c', 'eyJ.x.y', 'eyJhbGciOiJub25lIn0.not-json.sig', '']) expect(decodeJwt(t)).toBeNull() })
  it('metinden bulur ve tekrarlari eler', () => {
    const t = mk({ a: 1 })
    expect(findJwts(`Bearer ${t} ve yine ${t} ve ${mk({ b: 2 })}`)).toHaveLength(2)
    expect(findJwts('jwt yok')).toEqual([])
  })
  it('gecerlilik durumu', () => {
    const j = decodeJwt(mk({ exp: 1000 }))!
    expect(expiryOf(j, 900)).toEqual({ state: 'valid', deltaSec: 100 }); expect(expiryOf(j, 1100)).toEqual({ state: 'expired', deltaSec: 100 })
    expect(expiryOf(decodeJwt(mk({ a: 1 }))!)).toEqual({ state: 'none' })
    expect(expiryOf(decodeJwt(mk({ nbf: 2000, exp: 3000 }))!, 1000)).toEqual({ state: 'notyet', deltaSec: 1000 })
  })
  it('humanDelta', () => { expect(humanDelta(30)).toBe('30s'); expect(humanDelta(600)).toBe('10 min'); expect(humanDelta(7200)).toBe('2 h'); expect(humanDelta(-86400 * 3)).toBe('3 d') })
})
