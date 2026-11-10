import { describe, expect, it } from 'vitest'
import { leakHint, mb, metricMap } from './metrics'

describe('metrics', () => {
  it('leakHint: surekli artan seri isaretlenir; dalgali, kisa ve sabit seriler isaretlenmez', () => {
    const grow = Array.from({ length: 30 }, (_, i) => 1000 + i * 40)
    expect(leakHint(grow)).toBe(true)
    expect(leakHint(Array.from({ length: 30 }, (_, i) => 1000 + (i % 2 ? 300 : 0)))).toBe(false)
    expect(leakHint(grow.slice(0, 10))).toBe(false)
    expect(leakHint(Array(30).fill(1000))).toBe(false)
    expect(leakHint(Array.from({ length: 30 }, (_, i) => 1000 + i * 2))).toBe(false) // artis < %25
  })
  it('yardimcilar', () => { expect(mb(5 * 1048576)).toBe('5.0 MB'); expect(metricMap([{ name: 'Nodes', value: 3 }])).toEqual({ Nodes: 3 }); expect(metricMap(undefined)).toEqual({}) })
})
