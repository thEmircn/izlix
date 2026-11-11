import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { buildAiContext, buildRequest, MAX_PROMPT, needsKey, parseAnswer } from './ai'

const ev = (id: number, kind: string, ts: number, payload: any, extra: any = {}): BusEvent => ({ id, tabId: 't', kind: kind as any, ts, source: 'x', payload, causeIds: [], links: [], ...extra } as unknown as BusEvent)
describe('ai', () => {
  const events = [
    ev(1, 'navigation', 10, {}, { source: 'cdp:Page.frameNavigated' }),
    ev(2, 'request', 20, { requestId: 'r', url: 'http://a/api/items?token=SECRET123456&x=1', method: 'GET', type: 'XHR' }),
    ev(3, 'response', 30, { requestId: 'r', url: 'http://a/api/items?token=SECRET123456&x=1', status: 500, mimeType: 'application/json', type: 'XHR', headers: {} }),
    ev(4, 'error', 40, { text: 'TypeError: Cannot read properties of undefined (reading "map") Bearer abcdefghijklmnop', stackTrace: { callFrames: [{ functionName: 'List', url: 'http://a/src/List.tsx', lineNumber: 11 }] } }, { links: [{ from: 3, certainty: 'estimated', type: 'response->render' }] }),
    ev(5, 'console', 41, { level: 'error', text: 'Warning: failed' }), ev(6, 'render', 42, { name: 'List' })
  ]
  it('baglam: hata + yigin + basarisiz istek + zincir; sir maskelenir; sorgu degerleri gizlenir', () => {
    const c = buildAiContext(events, 'http://a/app/page?q=1', 4)
    expect(c).toContain('Page: /app/page?…'); expect(c).toContain('TypeError'); expect(c).toContain('at List (src/List.tsx:12)'); expect(c).toContain('REQUEST FAILED: GET /api/items?… -> 500'); expect(c).toContain('FOCUS CHAIN:'); expect(c).toContain('<- response')
    expect(c).toContain('RECENT RENDERS: List'); expect(c).not.toContain('SECRET123456'); expect(c).not.toContain('abcdefghijklmnop')
  })
  it('son gezinmeden onceki olaylar dahil edilmez; boyut sinirli', () => {
    expect(buildAiContext([ev(0, 'error', 5, { text: 'ESKI' }), ...events], 'http://a/').includes('ESKI')).toBe(false) // gezinmeden ONCE (ts 5 < 10)
  })
  it('boyut siniri', () => {
    const many = Array.from({ length: 6 }, (_, i) => ev(100 + i, 'error', 50 + i, { text: 'x'.repeat(5000) }))
    expect(buildAiContext(many, 'http://a/').length).toBeLessThanOrEqual(MAX_PROMPT + 1)
  })
  it('saglayici istekleri: yerel Ollama anahtarsiz; Anthropic/OpenAI anahtar yalniz basliga', () => {
    const o = buildRequest({ provider: 'ollama', model: 'm', endpoint: 'http://127.0.0.1:1234/' }, null, 'P', 'tr'); expect(o.url).toBe('http://127.0.0.1:1234/api/chat'); expect(o.body).toContain('Turkish'); expect(JSON.parse(o.body).stream).toBe(false)
    const a = buildRequest({ provider: 'anthropic', model: 'claude-sonnet-5-5' }, 'KEY', 'P', 'en'); expect(a.headers['x-api-key']).toBe('KEY'); expect(a.body).not.toContain('KEY'); expect(JSON.parse(a.body).messages[0].content).toBe('P')
    const p = buildRequest({ provider: 'openai', model: 'g' }, 'KEY', 'P', 'en'); expect(p.headers.authorization).toBe('Bearer KEY'); expect(p.body).not.toContain('KEY')
  })
  it('yanit ayristirma', () => {
    expect(parseAnswer('ollama', { message: { content: 'a' } })).toBe('a'); expect(parseAnswer('anthropic', { content: [{ type: 'text', text: 'b' }, { type: 'tool_use' }] })).toBe('b'); expect(parseAnswer('openai', { choices: [{ message: { content: 'c' } }] })).toBe('c')
    expect(parseAnswer('openai', {})).toBeNull(); expect(needsKey('ollama')).toBe(false); expect(needsKey('openai')).toBe(true)
  })
})
