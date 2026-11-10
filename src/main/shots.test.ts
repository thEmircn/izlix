import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({}))
import { shotName } from './shots'

describe('shotName', () => {
  it('host ve zaman damgasi', () => { expect(shotName('http://localhost:5173/x', new Date('2026-01-02T03:04:05Z'))).toBe('izlix-localhost-2026-01-02T03-04-05.png') })
  it('gecersiz url ve tehlikeli karakterler', () => {
    expect(shotName('garbage', new Date('2026-01-02T03:04:05Z'))).toContain('izlix-page-')
    expect(shotName('https://a.com/../../x', new Date()).includes('/')).toBe(false)
  })
})
