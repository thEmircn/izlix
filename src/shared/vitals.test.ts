import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { rate, summarizeVitals } from './vitals'

const ev = (id: number, ts: number, kind: BusEvent['kind'], payload: any, source = 's'): BusEvent => ({ id, tabId: 't', ts, kind, source, payload, causeIds: [], links: [] })
describe('vitals', () => {
  it('derecelendirme esikleri', () => {
    expect(rate('LCP', 2500)).toBe('good'); expect(rate('LCP', 3000)).toBe('needs'); expect(rate('LCP', 5000)).toBe('poor')
    expect(rate('CLS', 0.05)).toBe('good'); expect(rate('CLS', 0.3)).toBe('poor'); expect(rate('INP', 250)).toBe('needs'); expect(rate('bilinmeyen', 1e9)).toBe('good')
  })
  it('son gezinmeden sonrakileri ozetler; son deger kazanir; TBT 50 ms ustunu toplar', () => {
    const s = summarizeVitals([
      ev(1, 100, 'vital', { name: 'LCP', value: 9999 }),
      ev(2, 200, 'navigation', {}, 'cdp:Page.frameNavigated'),
      ev(3, 300, 'vital', { name: 'LCP', value: 1200, el: 'h1' }), ev(4, 310, 'vital', { name: 'LCP', value: 2600, el: 'img' }),
      ev(5, 320, 'vital', { name: 'CLS', value: 0.02 }), ev(6, 330, 'vital', { name: 'CLS', value: 0.12 }),
      ev(7, 340, 'vital', { name: 'longtask', value: 120, start: 5 }), ev(8, 350, 'vital', { name: 'longtask', value: 60, start: 9 }), ev(9, 360, 'vital', { name: 'longtask', value: 40, start: 12 }),
      ev(10, 370, 'vital', { name: 'DCL', value: 400 }), ev(11, 380, 'vital', { name: 'Load', value: 900 })
    ])
    expect(s.vitals.map((v) => [v.name, v.value, v.rating])).toEqual([['LCP', 2600, 'needs'], ['CLS', 0.12, 'needs']])
    expect(s.vitals[0].detail).toBe('<img>')
    expect(s.tbt).toBe(80); expect(s.longTasks).toHaveLength(3); expect(s.shifts).toBe(2); expect(s.dcl).toBe(400); expect(s.load).toBe(900)
  })
  it('bos', () => { const s = summarizeVitals([]); expect(s.vitals).toEqual([]); expect(s.tbt).toBe(0); expect(s.load).toBeNull() })
})
