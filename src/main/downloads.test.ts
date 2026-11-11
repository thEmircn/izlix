import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' }, shell: {} }))
import { join } from 'node:path'
import { uniquePath } from './downloads'

describe('uniquePath', () => {
  it('cakismada (n) ekler, uzantiyi korur', () => {
    const taken = new Set([join('/d', 'a.pdf'), join('/d', 'a (1).pdf')])
    expect(uniquePath('/d', 'a.pdf', (p) => taken.has(p))).toBe(join('/d', 'a (2).pdf'))
    expect(uniquePath('/d', 'b.zip', (p) => taken.has(p))).toBe(join('/d', 'b.zip'))
  })
  it('yol gecisini engeller (yalnizca dosya adi)', () => {
    expect(uniquePath('/d', '../../etc/passwd', () => false)).toBe(join('/d', 'passwd'))
    expect(uniquePath('/d', '', () => false)).toBe(join('/d', 'download'))
  })
})
