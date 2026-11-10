import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { typeBreakdown, replayExpression, toCurl, toFetch, buildNetworkRows, formatBytes, formatMs, nameOf, statusClass, typeOf } from './network'

const ev = (id: number, ts: number, kind: BusEvent['kind'], payload: any): BusEvent => ({ id, tabId: 't', ts, kind, source: 's', payload, causeIds: [], links: [] })

describe('buildNetworkRows', () => {
  const events = [
    ev(1, 1000, 'request', { requestId: 'a', url: 'http://x.com/api/items?p=1', method: 'GET', type: 'Fetch' }),
    ev(2, 1100, 'response', { requestId: 'a', status: 200, mimeType: 'application/json', size: 2048, finishedTs: 1150 }),
    ev(3, 1200, 'request', { requestId: 'b', url: 'http://x.com/app.js', method: 'GET', type: 'Script', modified: { kinds: ['delay'] } }),
    ev(4, 1300, 'request', { requestId: 'c', url: 'http://x.com/nope', method: 'POST', type: 'XHR' }),
    ev(5, 1350, 'error', { requestId: 'c', errorText: 'net::ERR_FAILED' }),
    ev(6, 1400, 'console', { text: 'x' })
  ]
  const rows = buildNetworkRows(events)
  it('istek, yanit ve hatayi requestId ile birlestirir; sira korunur', () => {
    expect(rows.map((r) => r.requestId)).toEqual(['a', 'b', 'c'])
    expect(rows[0]).toMatchObject({ status: 200, size: 2048, durationMs: 150, type: 'xhr', name: 'items?p=1', host: 'x.com', resId: 2 })
  })
  it('bekleyen, basarisiz ve degistirilmis istekler', () => {
    expect(rows[1]).toMatchObject({ status: null, durationMs: null, modified: true, type: 'js' })
    expect(rows[2]).toMatchObject({ failed: 'net::ERR_FAILED', durationMs: 50 })
    expect(statusClass(rows[1])).toBe('pending'); expect(statusClass(rows[2])).toBe('failed'); expect(statusClass(rows[0])).toBe('ok')
  })
  it('yardimcilar', () => {
    expect(statusClass({ status: 404, failed: null })).toBe('client'); expect(statusClass({ status: 503, failed: null })).toBe('server'); expect(statusClass({ status: 302, failed: null })).toBe('redirect')
    expect(formatBytes(512)).toBe('512 B'); expect(formatBytes(2048)).toBe('2.0 kB'); expect(formatBytes(5 * 1048576)).toBe('5.0 MB'); expect(formatBytes(null)).toBe('')
    expect(formatMs(80)).toBe('80 ms'); expect(formatMs(1500)).toBe('1.50 s')
    expect(typeOf('Stylesheet')).toBe('css'); expect(typeOf('???')).toBe('other')
    expect(nameOf('http://a.com/')).toBe('a.com'); expect(nameOf('garbage')).toBe('garbage')
  })
})

describe('toCurl / toFetch', () => {
  it('curl: yontem, basliklar, govde; cerez ve tarayici basliklari atlanir; tirnak kacirilir', () => {
    const c = toCurl('POST', "http://a.com/x?q=1", { 'Content-Type': 'application/json', Cookie: 'a=b', 'sec-ch-ua': 'x', Authorization: "Bearer it's" }, '{"a":1}')
    expect(c).toContain("curl 'http://a.com/x?q=1'")
    expect(c).toContain('-X POST'); expect(c).toContain("-H 'Content-Type: application/json'")
    expect(c).not.toContain('Cookie'); expect(c).not.toContain('sec-ch-ua')
    expect(c).toContain(`'Authorization: Bearer it'\\''s'`)
    expect(c).toContain(`--data-raw '{"a":1}'`)
    expect(toCurl('GET', 'http://a.com', {})).toBe("curl 'http://a.com'")
  })
  it('fetch', () => {
    const f = toFetch('PUT', 'http://a.com', { 'X-A': '1', Host: 'a.com' }, 'b')
    expect(f).toContain('fetch("http://a.com"'); expect(f).toContain('"method": "PUT"'); expect(f).toContain('"X-A": "1"'); expect(f).not.toContain('Host')
  })
})

describe('WebSocket satirlari', () => {
  it('baglanti, el sikisma, mesaj sayisi ve kapanis', () => {
    const rows = buildNetworkRows([
      ev(1, 1000, 'request', { requestId: 'w', url: 'ws://x/live', method: 'WS', type: 'WebSocket' }),
      ev(2, 1010, 'response', { requestId: 'w', status: 101, type: 'WebSocket' }),
      ev(3, 1100, 'ws', { requestId: 'w', dir: 'sent', data: 'hi', size: 2 }), ev(4, 1200, 'ws', { requestId: 'w', dir: 'recv', data: 'yo', size: 2 }),
      ev(5, 1300, 'ws', { requestId: 'w', dir: 'closed' })
    ])
    expect(rows[0]).toMatchObject({ type: 'ws', status: 101, frames: 2, closed: true, durationMs: 300 })
  })
})

describe('replayExpression', () => {
  it('govde yalniz GET/HEAD disinda; cerez ve tarayici basliklari atlanir; gecerli JS', () => {
    const e = replayExpression('POST', 'http://a.com/x', { 'X-A': '1', Cookie: 'c=1', Host: 'a' }, '{"a":1}')
    expect(e).toContain('"body":"{\\"a\\":1}"'); expect(e).not.toContain('Cookie'); expect(e).toContain('"X-A":"1"')
    expect(replayExpression('GET', 'http://a.com', {}, 'ignored')).not.toContain('body')
    const AsyncFn = Object.getPrototypeOf(async function () {}).constructor
    expect(() => new AsyncFn(`return ${e.replace(/^await /, '')}`)).not.toThrow(); expect(e.startsWith('await ')).toBe(true)
  })
})

describe('typeBreakdown', () => {
  it('bayt toplami ve yuzde; buyukten kucuge', () => {
    const b = typeBreakdown([{ type: 'js', size: 3000 }, { type: 'js', size: 1000 }, { type: 'css', size: 1000 }, { type: 'img', size: null }])
    expect(b.map((x) => [x.type, x.bytes, x.count])).toEqual([['js', 4000, 2], ['css', 1000, 1], ['img', 0, 1]])
    expect(Math.round(b[0].pct)).toBe(80); expect(typeBreakdown([])).toEqual([])
  })
})
