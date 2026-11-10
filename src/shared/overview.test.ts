import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { summarizeOverview } from './overview'

let id = 0
const ev = (kind: string, ts: number, payload: any = {}, source = 'test'): BusEvent => ({ id: ++id, tabId: 't', ts, kind: kind as any, source, payload, links: [] } as any)
const req = (rid: string, ts: number, url = 'http://a/api/x') => ev('request', ts, { requestId: rid, method: 'GET', url, type: 'Fetch' }, 'cdp:Network.requestWillBeSent')
const res = (rid: string, ts: number, status: number, url = 'http://a/api/x') => ev('response', ts, { requestId: rid, status, url, type: 'Fetch', mime: 'application/json' }, 'cdp:Network.responseReceived')

describe('summarizeOverview', () => {
  it('bos olaylar: sifirlar ve saglikli', () => {
    const o = summarizeOverview([])
    expect(o).toMatchObject({ requests: 0, failed: 0, errors: 0, commits: 0, healthy: true, p95: null })
    expect(o.reqSeries).toHaveLength(24)
  })
  it('istek ve basarisiz istek sayilir, saglik bozulur', () => {
    const o = summarizeOverview([req('1', 1000), res('1', 1100, 200), req('2', 2000), res('2', 2200, 500)])
    expect(o.requests).toBe(2); expect(o.failed).toBe(1); expect(o.healthy).toBe(false)
    expect(o.reqSeries.reduce((a, b) => a + b, 0)).toBe(2)
  })
  it('render sayisi: commit ve toplam render', () => {
    const o = summarizeOverview([ev('render', 10, { count: 3, components: [] }), ev('render', 20, { count: 2, components: [] }), ev('render', 30, { count: 0 })])
    expect(o.commits).toBe(2); expect(o.renders).toBe(5)
  })
  it('etkinlik listesi en yeni basta ve en fazla 9', () => {
    const evs = Array.from({ length: 15 }, (_, i) => ev('input', 100 + i, { name: 'click', target: 'b' + i }))
    const o = summarizeOverview(evs)
    expect(o.activity).toHaveLength(9); expect(o.activity[0].payload.target).toBe('b14')
  })
  it('gezinmeden onceki olaylar sayilmaz', () => {
    const o = summarizeOverview([req('1', 1), res('1', 2, 500), ev('navigation', 10, {}, 'cdp:Page.frameNavigated'), req('2', 20), res('2', 25, 200)])
    expect(o.requests).toBe(1); expect(o.failed).toBe(0)
  })
})
