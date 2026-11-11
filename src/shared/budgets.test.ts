import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { checkBudgets, collectMetrics, compareMetrics, DEFAULT_BUDGET, type Metrics } from './budgets'

const ev = (id: number, kind: string, ts: number, payload: any, source = 'x'): BusEvent => ({ id, tabId: 't', kind: kind as any, ts, source, payload, causeIds: [], links: [] } as unknown as BusEvent)
describe('budgets', () => {
  it('collectMetrics: son gezinmeden sonra vitals + ag', () => {
    const events = [
      ev(1, 'request', 1, { requestId: 'old', url: 'http://a/old', method: 'GET' }), ev(2, 'navigation', 100, {}, 'cdp:Page.frameNavigated'),
      ev(3, 'request', 101, { requestId: 'r1', url: 'http://a/x.js', method: 'GET', type: 'Script' }), ev(4, 'response', 110, { requestId: 'r1', url: 'http://a/x.js', status: 200, mimeType: 'text/javascript', type: 'Script', headers: { 'content-length': '2048' } }),
      ev(5, 'vital', 150, { name: 'LCP', value: 3100 }), ev(6, 'vital', 151, { name: 'CLS', value: 0.05 }), ev(7, 'vital', 152, { name: 'longtask', value: 200, start: 5 }), ev(8, 'vital', 160, { name: 'Load', value: 900 })
    ]
    const m = collectMetrics(events)
    expect(m).toMatchObject({ lcp: 3100, cls: 0.05, tbt: 150, load: 900, requests: 1 })
  })
  it('checkBudgets: asilan metrikler; olcum yok/limit yok atlanir', () => {
    const m: Metrics = { lcp: 3100, cls: 0.05, tbt: 150, requests: 80, transferKB: 900, ts: 0 }
    expect(checkBudgets(m, DEFAULT_BUDGET)).toEqual([{ key: 'lcp', value: 3100, limit: 2500 }])
    expect(checkBudgets(m, { requests: 50, transferKB: 1000, inp: 100 }).map((v) => v.key)).toEqual(['requests']) // inp olcumu yok
    expect(checkBudgets(m, {})).toEqual([])
  })
  it('compareMetrics: dusus iyi, yalniz ortak metrikler', () => {
    const a: Metrics = { lcp: 3000, cls: 0.1, requests: 50, transferKB: 500, ts: 1 }, b: Metrics = { lcp: 2000, requests: 60, transferKB: 500, ts: 2 }
    expect(compareMetrics(a, b)).toEqual([{ key: 'lcp', prev: 3000, cur: 2000, delta: -1000, better: true }, { key: 'requests', prev: 50, cur: 60, delta: 10, better: false }])
    expect(compareMetrics(undefined, b)).toEqual([])
  })
})
