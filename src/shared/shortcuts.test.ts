import { describe, expect, it } from 'vitest'
import { DEFAULT_SHORTCUTS, mergeShortcuts, resolveShortcut } from './shortcuts'
import { resolveInput } from './url'
const L = mergeShortcuts([])
describe('shortcuts', () => {
  it('anahtar + sorgu: kodlanmis arama URL\'si', () => {
    expect(resolveShortcut('yt kedi videolari', L)?.url).toBe('https://www.youtube.com/results?search_query=kedi%20videolari')
    expect(resolveShortcut('YT kedi', L)?.shortcut.key).toBe('yt')
  })
  it('gh owner/repo ve npm paket: dogrudan sayfa', () => {
    expect(resolveShortcut('gh vercel/next.js', L)?.url).toBe('https://github.com/vercel/next.js'); expect(resolveShortcut('gh react hooks', L)?.url).toContain('github.com/search?q=react%20hooks')
    expect(resolveShortcut('npm @types/node', L)?.url).toBe('https://www.npmjs.com/package/@types/node'); expect(resolveShortcut('npm react router', L)?.url).toContain('npmjs.com/search')
  })
  it('bilinmeyen anahtar / sorgusuz / tek kelime: null', () => { expect(resolveShortcut('zzz kedi', L)).toBeNull(); expect(resolveShortcut('yt', L)).toBeNull(); expect(resolveShortcut('yt   ', L)).toBeNull() })
  it('kullanici kisayolu varsayilani ezer; gecersiz sablon/anahtar atilir', () => {
    const m = mergeShortcuts([{ key: 'yt', url: 'https://example.com/?q=%s' }, { key: 'bad key', url: 'https://a.com/%s' }, { key: 'nope', url: 'javascript:%s' }, { key: 'x', url: 'https://a.com/' }])
    expect(resolveShortcut('yt a', m)?.url).toBe('https://example.com/?q=a'); expect(m.some((s) => s.key === 'bad key' || s.key === 'nope' || s.key === 'x')).toBe(false); expect(m.length).toBe(DEFAULT_SHORTCUTS.length)
  })
  it('resolveInput kisayolu arama motorundan once uygular', () => {
    expect(resolveInput('yt kedi', 'google', L)).toContain('youtube.com/results'); expect(resolveInput('kedi resmi', 'google', L)).toContain('google.com/search'); expect(resolveInput('example.com/yt kedi', 'google', L)).toContain('google.com/search')  })
})
