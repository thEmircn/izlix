import { describe, expect, it } from 'vitest'
import { screenAtPoint } from './screenpick'

const D = [{ id: 1, bounds: { x: 0, y: 0, width: 1440, height: 900 } }, { id: 2, bounds: { x: 1440, y: -200, width: 1920, height: 1080 } }]
const S = [{ id: 'screen:1:0', name: 'a', display_id: '1' }, { id: 'window:9:0', name: 'w', display_id: '' }, { id: 'screen:2:0', name: 'b', display_id: '2' }]
describe('screenAtPoint', () => {
  it('imlecin ekranini secer', () => {
    expect(screenAtPoint(S, D, { x: 100, y: 100 })?.name).toBe('a')
    expect(screenAtPoint(S, D, { x: 2000, y: -50 })?.name).toBe('b')
  })
  it('display_id bossa sirayla eslesir', () => {
    expect(screenAtPoint(S.map((s) => ({ ...s, display_id: '' })), D, { x: 2000, y: 0 })?.name).toBe('b')
  })
  it('ekran kaynagi yoksa null', () => { expect(screenAtPoint([S[1]], D, { x: 0, y: 0 })).toBeNull() })
})
