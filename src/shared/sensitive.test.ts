import { describe, expect, it } from 'vitest'
import { isSensitiveRequest, scrubHeaders } from './sensitive'

describe('hassas istek', () => {
  it('giris sunuculari ve POST giris yollari', () => {
    expect(isSensitiveRequest('https://accounts.google.com/v3/signin/challenge', 'POST')).toBe(true)
    expect(isSensitiveRequest('https://x.okta.com/a', 'GET')).toBe(true)
    expect(isSensitiveRequest('https://app.example.com/api/login', 'POST')).toBe(true)
    expect(isSensitiveRequest('https://app.example.com/oauth/token', 'POST')).toBe(true)
  })
  it('normal API ve GET giris sayfasi etkilenmez', () => {
    expect(isSensitiveRequest('https://app.example.com/api/items', 'POST')).toBe(false)
    expect(isSensitiveRequest('https://app.example.com/login', 'GET')).toBe(false)
    expect(isSensitiveRequest('http://localhost:5173/api/users', 'POST')).toBe(false)
  })
  it('hassas sekme her seyi kapsar', () => { expect(isSensitiveRequest('https://web.whatsapp.com/x', 'GET', true)).toBe(true) })
  it('basliklar maskelenir', () => {
    expect(scrubHeaders({ Authorization: 'Bearer x', Accept: 'a', cookie: 'c=1' })).toEqual({ Authorization: '[gizli]', Accept: 'a', cookie: '[gizli]' })
  })
})
