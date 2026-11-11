import { describe, expect, it } from 'vitest'
import { upgradeToHttps as up } from './https'
describe('upgradeToHttps', () => {
  it('genel alan adlarini yukseltir, yolu ve sorguyu korur', () => {
    expect(up('http://example.com/a?b=1#c')).toBe('https://example.com/a?b=1#c'); expect(up('http://www.site.com.tr/')).toBe('https://www.site.com.tr/')
  })
  it('yerel, IP, tek etiketli, ozel port, .onion/.local ve https dokunulmaz', () => {
    for (const u of ['http://localhost/', 'http://127.0.0.1/', 'http://192.168.1.5/', 'http://[::1]/', 'http://intranet/', 'http://a.com:8080/', 'http://x.onion/', 'http://printer.local/', 'https://a.com/', 'ftp://a.com/', 'nonsense']) expect(up(u)).toBeNull()
  })
})
