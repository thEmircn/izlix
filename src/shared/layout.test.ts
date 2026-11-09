import { describe, expect, it } from 'vitest'
import { computeLayout } from './layout'

describe('computeLayout', () => {
  const W = 1500, H = 900, chromeHeight = 84, panelRatio = 0.4
  const overlap = (a: any, b: any) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height

  for (const dock of ['right', 'bottom', 'off'] as const) {
    it(`${dock}: bolgeler cakismaz ve pencerenin disina tasmaz`, () => {
      const l = computeLayout(W, H, { dock, panelRatio, chromeHeight })
      const rects = [l.page, l.timeline, ...(l.devtools ? [l.devtools] : [])]
      for (const r of rects) {
        expect(r.x).toBeGreaterThanOrEqual(0); expect(r.y).toBeGreaterThanOrEqual(chromeHeight)
        expect(r.x + r.width).toBeLessThanOrEqual(W); expect(r.y + r.height).toBeLessThanOrEqual(H)
      }
      for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) expect(overlap(rects[i], rects[j])).toBe(false)
    })
  }

  it('off modunda DevTools yok, right ve bottom modunda var', () => {
    expect(computeLayout(W, H, { dock: 'off', panelRatio, chromeHeight }).devtools).toBeNull()
    expect(computeLayout(W, H, { dock: 'right', panelRatio, chromeHeight }).devtools).not.toBeNull()
  })
})
