import { describe, expect, it } from 'vitest'
import { iconMime, originKey, parseIconLinks, thumbKey } from './favicon'

describe('favicon yardimcilari', () => {
  it('originKey loopback hostlarini birlestirir, http disini reddeder', () => {
    expect(originKey('http://127.0.0.1:5173/a')).toBe('http://localhost:5173')
    expect(originKey('localhost:3000')).toBe('http://localhost:3000')
    expect(originKey('https://Example.com/x?y#z')).toBe('https://example.com')
    expect(originKey('file:///etc/passwd')).toBeNull(); expect(originKey('javascript:alert(1)')).toBeNull()
  })
  it('thumbKey hash atar, yolu korur', () => {
    expect(thumbKey('https://a.com/p?q=1#frag')).toBe('https://a.com/p?q=1')
    expect(thumbKey('127.0.0.1:5173')).toBe('http://localhost:5173/')
  })
  it('iconMime boyut ve turu denetler', () => {
    expect(iconMime('image/png', 'x', 100)).toBe('image/png')
    expect(iconMime('text/html', 'x', 100)).toBeNull(); expect(iconMime('image/png', 'x', 10_000_000)).toBeNull()
    expect(iconMime('', 'http://a/favicon.ico', 10)).toBe('image/x-icon'); expect(iconMime('', 'http://a/x', 10)).toBeNull()
  })
  it('parseIconLinks gorecelileri cozer, apple-touch sona gider', () => {
    const html = '<link rel="apple-touch-icon" href="/a.png"><link rel="shortcut icon" href="fav.svg"><link rel="stylesheet" href="s.css"><link href="/n.ico" rel=icon>'
    expect(parseIconLinks(html, 'http://localhost:5173/app/')).toEqual(['http://localhost:5173/app/fav.svg', 'http://localhost:5173/a.png'])
  })
})
