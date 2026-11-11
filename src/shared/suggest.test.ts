import { describe, expect, it } from 'vitest'
import { inlineCompletion, looksLikeUrl, suggest, type SugSource } from './suggest'

const NOW = 1_800_000_000_000
const src: SugSource = {
  history: [
    { url: 'https://github.com/vercel/next.js', title: 'Next.js repo', ts: NOW - 86_400_000 },
    { url: 'https://news.ycombinator.com/', title: 'Hacker News', ts: NOW - 10 * 86_400_000 },
    { url: 'https://github.com/', title: 'GitHub', ts: NOW - 5 * 86_400_000 }
  ],
  bookmarks: [{ url: 'https://developer.mozilla.org/', title: 'MDN Web Docs' }],
  servers: [{ port: 5173, name: 'portal' }],
  tabs: [{ id: 'tab-2', url: 'https://github.com/', title: 'GitHub' }]
}

describe('suggest', () => {
  it('bos sorguda oneri yok', () => { expect(suggest('  ', src)).toEqual([]) })
  it('ilk oge yazilan metin: adres ise git, degilse ara', () => {
    expect(suggest('kedi', src, 7, NOW)[0]).toMatchObject({ kind: 'search', url: 'kedi' })
    expect(suggest('example.com', src, 7, NOW)[0]).toMatchObject({ kind: 'url' })
  })
  it('sekme > gecmis; ayni adres tek satir; host oneki one cikar', () => {
    const r = suggest('git', src, 7, NOW).slice(1)
    expect(r[0]).toMatchObject({ kind: 'tab', tabId: 'tab-2' })
    expect(r.filter((x) => x.url.startsWith('https://github.com/') && x.url.length === 19)).toHaveLength(1)
  })
  it('birden cok kelime hepsini icermeli (baslik dahil)', () => {
    expect(suggest('next repo', src, 7, NOW).slice(1).map((x) => x.url)).toEqual(['https://github.com/vercel/next.js'])
  })
  it('dev sunucusu ve yer imi bulunur', () => {
    expect(suggest('portal', src, 7, NOW)[1]).toMatchObject({ kind: 'server', url: 'http://localhost:5173' })
    expect(suggest('mdn', src, 7, NOW)[1]).toMatchObject({ kind: 'bookmark' })
  })
  it('limit uygulanir', () => { expect(suggest('a', src, 2, NOW).length).toBeLessThanOrEqual(3) })
})

describe('populer siteler', () => {
  it('hic gitmedigin site ad ya da alan adi onekiyle cikar, kullanici verisi ustte', () => {
    expect(suggest('yout', src, 8, NOW).slice(1).map((x) => x.url)).toContain('https://youtube.com')
    expect(suggest('trendy', src, 8, NOW)[1]).toMatchObject({ kind: 'site', title: 'Trendyol' })
    expect(suggest('git', src, 8, NOW)[1].kind).toBe('tab')
    expect(suggest('xqzv', src, 8, NOW)).toHaveLength(1) // gurultu yok
  })
  it('inlineCompletion populer alan adini tamamlar', () => { expect(inlineCompletion('hepsib', ['https://hepsiburada.com'])).toBe('hepsiburada.com') })
})

describe('inlineCompletion / looksLikeUrl', () => {
  it('host onekini tamamlar, yol/bosluk/sema varken tamamlamaz', () => {
    expect(inlineCompletion('git', ['https://github.com/x'])).toBe('github.com')
    expect(inlineCompletion('Git', ['https://www.github.com/x'])).toBe('Github.com')
    expect(inlineCompletion('github.com', ['https://github.com/'])).toBeNull()
    expect(inlineCompletion('git hub', ['https://github.com'])).toBeNull()
    expect(inlineCompletion('https://g', ['https://github.com'])).toBeNull()
    expect(inlineCompletion('loc', ['http://localhost:5173'])).toBe('localhost:5173')
  })
  it('looksLikeUrl', () => { expect(looksLikeUrl('localhost:3000')).toBe(true); expect(looksLikeUrl('kedi resmi')).toBe(false) })
})
