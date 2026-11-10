import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, shell: {} }))
import { uniquePath } from './downloads'

describe('uniquePath', () => {
  it('cakismada (n) ekler, uzantiyi korur', () => {
    const taken = new Set(['/d/a.pdf', '/d/a (1).pdf'])
    expect(uniquePath('/d', 'a.pdf', (p) => taken.has(p))).toBe('/d/a (2).pdf')
    expect(uniquePath('/d', 'b.zip', (p) => taken.has(p))).toBe('/d/b.zip')
  })
  it('yol gecisini engeller (yalnizca dosya adi)', () => {
    expect(uniquePath('/d', '../../etc/passwd', () => false)).toBe('/d/passwd')
    expect(uniquePath('/d', '', () => false)).toBe('/d/download')
  })
})
