import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({}))
import { originalPositionFor } from '@jridgewell/trace-mapping'
import { parseSourceMap } from './sources'

// "AAAA" = (0,0) -> kaynak (0,0); ikinci bolum 3. satirdan baslar
const flat = { version: 3, sources: ['/src/a.tsx'], names: [], mappings: 'AAAA;AACA' }
const sectioned = {
  version: 3,
  sections: [
    { offset: { line: 0, column: 0 }, map: { version: 3, sources: ['file:///p/app%20x/page.js'], names: [], mappings: 'AAAA;AACA' } },
    { offset: { line: 10, column: 0 }, map: { version: 3, sources: ['file:///p/lib.js'], names: [], mappings: 'AAAA' } }
  ]
}
describe('parseSourceMap', () => {
  it('duz harita', () => {
    const m = parseSourceMap(JSON.stringify(flat), 'http://x/a.js')
    expect(originalPositionFor(m, { line: 2, column: 0 }).line).toBe(2)
  })
  it('bolumlu (Turbopack) harita: bolum ofsetine gore dogru kaynak', () => {
    const m = parseSourceMap(JSON.stringify(sectioned), 'http://x/chunk.js')
    expect(originalPositionFor(m, { line: 2, column: 0 }).source).toContain('page.js')
    expect(originalPositionFor(m, { line: 11, column: 0 }).source).toContain('lib.js')
  })
})
