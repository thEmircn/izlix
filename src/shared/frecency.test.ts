import { describe, expect, it } from 'vitest'
import { boost, record, score, type Usage } from './frecency'

const DAY = 24 * 3600 * 1000
describe('frecency', () => {
  it('kayit sayar; puan zamanla azalir', () => {
    let u = record({}, 'a', 0); u = record(u, 'a', 0); u = record(u, 'b', 0)
    expect(u.a.n).toBe(2); expect(score(u, 'a', 0)).toBe(2); expect(score(u, 'a', 7 * DAY)).toBeCloseTo(1, 5); expect(score(u, 'yok', 0)).toBe(0)
  })
  it('bos sorguda kullanilanlar basa gelir; digerleri orijinal sirada', () => {
    const items = [{ id: 'x' }, { id: 'y' }, { id: 'z' }]
    const u = record(record({}, 'z', 100), 'z', 100)
    expect(boost(items, u, '', 100).map((i) => i.id)).toEqual(['z', 'x', 'y'])
  })
  it('sorguda eslesme sirasini yalnizca belirgin kullanimda bozar', () => {
    const items = [{ id: 'a' }, { id: 'b' }, { id: 'c' }]
    expect(boost(items, {}, 'q', 0).map((i) => i.id)).toEqual(['a', 'b', 'c'])
    let u: Usage = {}; for (let i = 0; i < 3; i++) u = record(u, 'c', 0)
    expect(boost(items, u, 'q', 0).map((i) => i.id)).toEqual(['c', 'a', 'b'])
  })
  it('200 kayitla sinirlanir (en eskiler atilir)', () => {
    let u: Usage = {}; for (let i = 0; i < 230; i++) u = record(u, `k${i}`, i)
    expect(Object.keys(u)).toHaveLength(200); expect(u.k0).toBeUndefined(); expect(u.k229).toBeDefined()
  })
})
