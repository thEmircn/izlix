import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { aggregateRenders, isMinifiedName, wastedRatio } from './tracker'

const commit = (id: number, ts: number, components: any[]): BusEvent => ({ id, tabId: 't', ts, kind: 'render', source: 'bridge:commit', payload: { count: components.length, components }, causeIds: [], links: [] })
describe('aggregateRenders', () => {
  const evs = [
    commit(1, 100, [{ name: 'List', t: 1, reason: 'state', ms: 2, hooks: [{ index: 0 }] }, { name: 'Row', t: 2, reason: 'parent', ms: 0.5 }]),
    commit(2, 200, [{ name: 'Row', t: 2, reason: 'parent', ms: 1.5 }, { name: 'Row', t: 2, reason: 'props', props: ['label'], ms: 1, file: '/a/Row.tsx', line: 4 }]),
    commit(3, 900, [{ name: 'Row', t: 2, reason: 'parent', ms: 9 }])
  ]
  it('sayar, sureleri toplar, nedenleri dagitir; en cok renderlanan ustte', () => {
    const rows = aggregateRenders(evs)
    expect(rows[0].name).toBe('Row')
    expect(rows[0].renders).toBe(4)
    expect(rows[0].totalMs).toBeCloseTo(12)
    expect(rows[0].maxMs).toBe(9)
    expect(rows[0].reasons).toEqual({ parent: 3, props: 1 })
    expect(rows[0].changedProps).toEqual(['label'])
    expect(rows[0].file).toBe('/a/Row.tsx')
    expect(wastedRatio(rows[0])).toBe(0.75)
    expect(rows[1].changedHooks).toEqual([0])
  })
  it('zaman araligi filtresi', () => {
    expect(aggregateRenders(evs, [0, 250]).find((r) => r.name === 'Row')!.renders).toBe(3)
  })
  it('ayni isimli farkli tipler ayri satir', () => {
    const rows = aggregateRenders([commit(1, 1, [{ name: 'X', t: 1, reason: 'mount' }, { name: 'X', t: 2, reason: 'mount' }])])
    expect(rows).toHaveLength(2)
  })
})

describe('isMinifiedName', () => {
  it('minify adlari yakalanir, gercek bilesen adlari yakalanmaz', () => {
    for (const n of ['b', 'N', 'l_', 'eY', 'e$', 'x1']) expect(isMinifiedName(n)).toBe(true)
    for (const n of ['App', 'List', 'Row', 'Page', 'Nav', 'Ab']) expect(isMinifiedName(n)).toBe(false)
  })
})
