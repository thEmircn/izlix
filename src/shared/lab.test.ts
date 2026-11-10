import { describe, expect, it } from 'vitest'
import { DEVICES, computeLabLayout, deviceById } from './lab'

const area = { x: 0, y: 84, width: 900, height: 800 }
describe('computeLabLayout', () => {
  it('tek viewport: sigarsa olcek 1', () => {
    const [s] = computeLabLayout(area, [{ width: 375, height: 667 }])
    expect(s.scale).toBe(1); expect(s.width).toBe(375)
  })
  it('hicbir slot alanin disina tasmaz ve birbiriyle cakismaz', () => {
    for (const ids of [['iphone-se', 'ipad-mini', 'desktop'], ['iphone-se', 'iphone-15', 'pixel-8', 'ipad-pro-11'], ['full-hd', 'laptop']]) {
      const slots = computeLabLayout(area, ids.map((i) => deviceById(i)!))
      for (const s of slots) {
        expect(s.x).toBeGreaterThanOrEqual(area.x); expect(s.y).toBeGreaterThanOrEqual(area.y)
        expect(s.x + s.width).toBeLessThanOrEqual(area.x + area.width + 1); expect(s.y + s.height).toBeLessThanOrEqual(area.y + area.height + 1)
      }
      for (let i = 0; i < slots.length; i++) for (let j = i + 1; j < slots.length; j++) {
        const a = slots[i], b = slots[j]
        expect(a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height).toBe(false)
      }
    }
  })
  it('dort telefon iki satira dizilip daha buyuk olcek verebilir', () => {
    const four = ['iphone-se', 'iphone-15', 'pixel-8', 'iphone-15-pro-max'].map((i) => deviceById(i)!)
    const slots = computeLabLayout({ x: 0, y: 0, width: 700, height: 1000 }, four)
    expect(new Set(slots.map((s) => s.y)).size).toBe(2)
  })
  it('cihaz kimlikleri benzersiz', () => { expect(new Set(DEVICES.map((d) => d.id)).size).toBe(DEVICES.length) })
})
