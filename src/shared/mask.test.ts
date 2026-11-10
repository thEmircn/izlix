import { describe, expect, it } from 'vitest'
import { MASK, maskDeep, maskString } from './mask'

const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.abc_DEF-123'
describe('mask', () => {
  it('JWT, Bearer ve sorgu parametresi tokenlari maskelenir', () => {
    expect(maskString(`x ${jwt} y`)).toBe(`x ${MASK} y`)
    expect(maskString('Authorization: Bearer abcdef123456')).not.toContain('abcdef123456')
    expect(maskString('https://a.com/x?access_token=SECRET&b=1')).toBe(`https://a.com/x?access_token=${MASK}&b=1`)
  })
  it('hassas anahtarlar (buyuk/kucuk harf fark etmez) derinlemesine maskelenir', () => {
    const r = maskDeep({ headers: { Authorization: 'Bearer zzzzzzzzzz', 'Set-Cookie': 'sid=1', Accept: 'json' }, list: [{ cookie: 'a=b' }], n: 5 })
    expect(r.headers.Authorization).toBe(MASK)
    expect(r.headers['Set-Cookie']).toBe(MASK)
    expect(r.headers.Accept).toBe('json')
    expect(r.list[0].cookie).toBe(MASK)
    expect(r.n).toBe(5)
  })
  it('girdiyi degistirmez', () => {
    const o = { token: 'abc' }
    maskDeep(o)
    expect(o.token).toBe('abc')
  })
})
