import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { causeChain, effectsOf } from './chain'

const e = (id: number, ts: number, links: BusEvent['links'] = [], kind: BusEvent['kind'] = 'request'): BusEvent => ({ id, tabId: 't', ts, kind, source: 's', payload: {}, causeIds: links.map((l) => l.from), links })
const evs = [
  e(1, 1000, [], 'input'),
  e(2, 1010, [{ from: 1, certainty: 'exact', type: 'input→request' }]),
  e(3, 1130, [{ from: 2, certainty: 'exact', type: 'request→response' }], 'response'),
  e(4, 1140, [{ from: 3, certainty: 'estimated', type: 'response→render' }], 'render'),
  e(5, 1141, [{ from: 4, certainty: 'exact', type: 'render→error' }], 'error')
]
const byId = new Map(evs.map((x) => [x.id, x]))

describe('causeChain', () => {
  it('hatadan girdiye kadar zinciri kok -> hata sirasinda, bag ve sure ile verir', () => {
    const c = causeChain(byId, 5)
    expect(c.map((s) => s.ev.id)).toEqual([1, 2, 3, 4, 5])
    expect(c[0].via).toBeUndefined()
    expect(c[1].via).toEqual({ type: 'input→request', certainty: 'exact' })
    expect(c[3].via).toEqual({ type: 'response→render', certainty: 'estimated' })
    expect(c.map((s) => s.dtMs)).toEqual([undefined, 10, 120, 10, 1])
  })
  it('kok olay tek adim; bilinmeyen id bos', () => {
    expect(causeChain(byId, 1).map((s) => s.ev.id)).toEqual([1])
    expect(causeChain(byId, 99)).toEqual([])
  })
  it('dongu ve uzunluk siniri', () => {
    const a = e(10, 1, [{ from: 11, certainty: 'exact', type: 'x' }]), b = e(11, 2, [{ from: 10, certainty: 'exact', type: 'y' }])
    expect(causeChain(new Map([[10, a], [11, b]]), 10).length).toBe(2)
    const long = Array.from({ length: 30 }, (_, i) => e(i + 1, i, i ? [{ from: i, certainty: 'exact', type: 't' }] : []))
    expect(causeChain(new Map(long.map((x) => [x.id, x])), 30, 12)).toHaveLength(12)
  })
  it('kesin bag tahmini bagdan once secilir', () => {
    const x = e(20, 5, [{ from: 21, certainty: 'estimated', type: 'est' }, { from: 22, certainty: 'exact', type: 'ex' }])
    const c = causeChain(new Map([[20, x], [21, e(21, 1)], [22, e(22, 2)]]), 20)
    expect(c.map((s) => s.ev.id)).toEqual([22, 20])
  })
})

describe('effectsOf', () => {
  it('dogrudan sonuclari zaman sirasinda verir', () => {
    expect(effectsOf(evs, 2).map((x) => x.ev.id)).toEqual([3])
    expect(effectsOf(evs, 5)).toEqual([])
  })
})
