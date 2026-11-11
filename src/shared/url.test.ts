import { describe, expect, it } from 'vitest'
import { isAllowedPageNavigation, resolveInput } from './url'
import { ENGINES, engineById, searchUrl } from './search'

describe('resolveInput', () => {
  it.each([
    ['localhost:5173', 'http://localhost:5173'],
    ['localhost:3000/app?x=1', 'http://localhost:3000/app?x=1'],
    ['127.0.0.1:8080', 'http://127.0.0.1:8080'],
    ['myapp.local:3000', 'http://myapp.local:3000'],
    ['example.com', 'https://example.com'],
    ['example.com/a/b?c=d', 'https://example.com/a/b?c=d'],
    ['https://a.dev/x', 'https://a.dev/x'],
    ['http://localhost:1', 'http://localhost:1'],
    ['about:blank', 'about:blank'],
    ['react useEffect cleanup', 'https://duckduckgo.com/?q=react%20useEffect%20cleanup'],
    ['', 'about:blank']
  ])('%s -> %s', (input, out) => expect(resolveInput(input)).toBe(out))
})

describe('isAllowedPageNavigation', () => {
  it('yalnizca http(s) ve about:blank', () => {
    for (const u of ['https://a.com', 'http://localhost:3000/x', 'about:blank', ' HTTPS://A.COM']) expect(isAllowedPageNavigation(u)).toBe(true)
    for (const u of ['file:///etc/passwd', 'javascript:alert(1)', 'izlix://open?dir=/', 'vscode://file/x', 'data:text/html,hi', 'view-source:https://a.com', 'about:srcdoc', 'blob:https://a.com/x']) expect(isAllowedPageNavigation(u)).toBe(false)
  })
})

describe('arama motorlari', () => {
  it('secili motorda arar; bilinmeyen motor varsayilana duser; .onion http olur', () => {
    expect(resolveInput('kedi resimleri', 'google')).toBe('https://www.google.com/search?q=kedi%20resimleri')
    expect(resolveInput('kedi', 'yandex')).toBe('https://yandex.com.tr/search/?text=kedi')
    expect(resolveInput('kedi', 'yok')).toBe(searchUrl('duckduckgo', 'kedi')); expect(engineById(undefined).id).toBe('duckduckgo')
    expect(resolveInput('abcdefghijklmnop.onion/path')).toBe('http://abcdefghijklmnop.onion/path')
    expect(resolveInput('example.com', 'google')).toBe('https://example.com')
  })
  it('tum motorlar %s yer tutucusu ve https icerir', () => { for (const e of ENGINES) { expect(e.url).toContain('%s'); expect(e.url.startsWith('https://')).toBe(true) } })
})
