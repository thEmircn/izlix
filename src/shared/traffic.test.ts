import { describe, expect, it } from 'vitest'
import type { NetRow } from './network'
import { binEvents, binTraffic, rate, smooth } from './traffic'

const row = (start: number, over: Partial<NetRow> = {}): NetRow => ({ id: start, requestId: String(start), method: 'GET', url: 'http://a/x', name: 'x', host: 'a', type: 'xhr', status: 200, failed: null, mime: '', size: 100, start, end: start + 50, durationMs: 50, modified: false, resId: null, fromCache: false, frames: 0, closed: false, ...over })

describe('binTraffic', () => {
  it('istekleri, hatalari ve baytlari kovalara dagitir', () => {
    const now = 100_000
    const b = binTraffic([row(99_900), row(99_950, { status: 500 }), row(70_000, { size: 400, end: 70_100 })], now)
    const last = Math.floor((99_900 - b.startT) / 500)
    expect(b.reqs[last]).toBe(2); expect(b.fails[last]).toBe(1); expect(b.bytes[last]).toBe(100); expect(b.bytes[last + 1]).toBe(100)
    expect(b.reqs.reduce((a, c) => a + c, 0)).toBe(3); expect(b.bytes.reduce((a, c) => a + c, 0)).toBe(600)
  })
  it('pencere disindaki ve websocket satirlari sayilmaz', () => {
    const b = binTraffic([row(10_000), row(99_000, { type: 'ws' })], 100_000)
    expect(b.reqs.reduce((a, c) => a + c, 0)).toBe(0)
  })
})
describe('smooth / rate', () => {
  it('smooth toplami korur (orta bolgede) ve zirveyi yayar', () => {
    const s = smooth([0, 0, 9, 0, 0])
    expect(s[2]).toBeCloseTo(3); expect(s[1]).toBeCloseTo(2); expect(s.reduce((a, c) => a + c, 0)).toBeCloseTo(9)
  })
  it('rate son saniyelerin ortalamasini verir (acik kovayi saymaz)', () => {
    const b = binTraffic([row(99_000), row(99_600), row(99_700)], 100_000)
    expect(rate(b, b.reqs, 2)).toBeCloseTo(1.5)
  })
})

describe('binEvents', () => {
  const ev = (kind: string, ts: number, payload: any = {}): any => ({ id: ts, tabId: 't', ts, kind, source: 's', payload, links: [] })
  it('olay, render ve hata sayilari; vital/state sayilmaz', () => {
    const b = binEvents([ev('input', 99_900), ev('render', 99_920, { count: 3 }), ev('render', 99_930, { count: 0 }), ev('error', 99_940), ev('console', 99_950, { level: 'error' }), ev('vital', 99_960)], 100_000)
    const i = Math.floor((99_900 - b.startT) / 500)
    expect(b.reqs[i]).toBe(5); expect(b.bytes[i]).toBe(1); expect(b.fails[i]).toBe(2)
  })
  it('pencere disindaki olaylar atlanir', () => { expect(binEvents([ev('input', 1000)], 100_000).reqs.reduce((a, c) => a + c, 0)).toBe(0) })
})
