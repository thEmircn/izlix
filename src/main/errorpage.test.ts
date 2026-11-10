import { describe, expect, it } from 'vitest'
import { errorPageHtml, shouldRetry } from './errorpage'

describe('errorPageHtml', () => {
  it('url ve aciklama HTML-kacirilir (XSS yok)', () => {
    const h = errorPageHtml('http://x/"><script>alert(1)</script>', -102, '<b>REFUSED</b>', [5173], 'en', true)
    expect(h).not.toContain('<script>'); expect(h).not.toContain('<b>')
    expect(h).toContain('localhost:5173'); expect(h).toContain('Retrying')
  })
  it('dil ve yeniden deneme bayragi', () => {
    expect(errorPageHtml('http://a', -1, 'x', [], 'tr', false)).toContain('ulaşılamıyor')
    expect(errorPageHtml('http://a', -1, 'x', [], 'tr', false)).not.toContain('otomatik')
  })
})
describe('shouldRetry', () => {
  const lb = (h: string): boolean => h === 'localhost'
  it('yalnizca http(s) loopback', () => {
    expect(shouldRetry('http://localhost:3000/', lb)).toBe(true)
    expect(shouldRetry('https://example.com/', lb)).toBe(false)
    expect(shouldRetry('file:///x', lb)).toBe(false)
    expect(shouldRetry('garbage', lb)).toBe(false)
  })
})
