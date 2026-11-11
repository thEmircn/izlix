import { describe, expect, it } from 'vitest'
import { cleanTrackingParams as c } from './tracking'
describe('cleanTrackingParams', () => {
  it('izleme parametrelerini siler, digerlerini ve sirayi korur', () => {
    expect(c('https://a.com/p?utm_source=x&id=5&fbclid=abc&q=kedi#h')).toBe('https://a.com/p?id=5&q=kedi#h')
    expect(c('https://a.com/?gclid=1&UTM_Medium=m')).toBe('https://a.com/')
  })
  it('degisiklik yoksa ayni dizgeyi doner; gecersiz ve http disi dokunulmaz', () => {
    expect(c('https://a.com/p?id=5')).toBe('https://a.com/p?id=5'); expect(c('not a url')).toBe('not a url'); expect(c('mailto:x?utm_source=1')).toBe('mailto:x?utm_source=1')
  })
  it('loopback varsayilan olarak dokunulmaz; allowLoopback ile temizlenir', () => {
    expect(c('http://localhost:3000/?utm_source=a')).toBe('http://localhost:3000/?utm_source=a'); expect(c('http://localhost:3000/?utm_source=a', true)).toBe('http://localhost:3000/')
  })
  it('YouTube paylasim si parametresi yalniz YouTube alan adlarinda', () => {
    expect(c('https://youtu.be/abc?si=zzz&t=5')).toBe('https://youtu.be/abc?t=5'); expect(c('https://a.com/?si=1')).toBe('https://a.com/?si=1')
  })
})
