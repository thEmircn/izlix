import { describe, expect, it } from 'vitest'
import { normalizeOrder } from './groups'
const g = (m: Record<string, string>) => (id: string): string | undefined => m[id]
describe('normalizeOrder', () => {
  it('grup sekmelerini bitistirir, ilk sekmenin yerinde, sirayi korur', () => {
    expect(normalizeOrder(['a', 'x', 'b', 'y', 'c'], g({ a: 'G', b: 'G', c: 'G' }), () => false)).toEqual(['a', 'b', 'c', 'x', 'y'])
    expect(normalizeOrder(['x', 'a', 'y', 'b'], g({ a: 'G', b: 'G' }), () => false)).toEqual(['x', 'a', 'b', 'y'])
  })
  it('iki grup ve sabitlenmisler basta', () => {
    expect(normalizeOrder(['a', 'p', 'b', 'c', 'd'], g({ a: 'G1', b: 'G2', c: 'G1', d: 'G2' }), (i) => i === 'p')).toEqual(['p', 'a', 'c', 'b', 'd'])
  })
  it('grupsuzda degisiklik yok', () => { expect(normalizeOrder(['a', 'b'], () => undefined, () => false)).toEqual(['a', 'b']) })
})
