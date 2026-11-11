import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({}))
import { ADAPTERS } from './adapters'
import { SUPPORTED_FRAMEWORKS } from '../shared/frameworks'

describe('framework adaptorleri (sozlesme)', () => {
  it('kimlikler benzersiz, etiket ve betik dolu; betikler gecerli JS', () => {
    expect(new Set(ADAPTERS.map((a) => a.id)).size).toBe(ADAPTERS.length)
    for (const a of ADAPTERS) { expect(a.label.length).toBeGreaterThan(0); expect(typeof a.script).toBe('string'); expect(() => new Function(a.script), a.id).not.toThrow() }
  })
  it('algilama listesindeki desteklenen framework\'lerin adaptoru kayitli', () => {
    for (const id of SUPPORTED_FRAMEWORKS) expect(ADAPTERS.map((a) => a.id), id).toContain(id)
  })
})
