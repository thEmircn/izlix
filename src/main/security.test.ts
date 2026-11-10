import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ net: {}, protocol: {} }))
import { isInsideAny, resolveAppPath } from './security'

describe('resolveAppPath', () => {
  const root = '/app/out/renderer'
  it('kok ve alt dosyalar', () => {
    expect(resolveAppPath(root, '/')).toBe('/app/out/renderer/index.html')
    expect(resolveAppPath(root, '/assets/a.js')).toBe('/app/out/renderer/assets/a.js')
  })
  it('yol gecisi (../, kodlanmis, null bayt) reddedilir', () => {
    expect(resolveAppPath(root, '/../../etc/passwd')).toBeNull()
    expect(resolveAppPath(root, '/%2e%2e/%2e%2e/etc/passwd')).toBeNull()
    expect(resolveAppPath(root, '/a/../../x')).toBeNull()
    expect(resolveAppPath(root, '/a%00b')).toBeNull()
    expect(resolveAppPath(root, '/%E0%A4%A')).toBeNull()
  })
  it('kardes dizin on eki yaniltmaz', () => {
    expect(resolveAppPath(root, '/../renderer-evil/x')).toBeNull()
  })
})

describe('isInsideAny', () => {
  it('kok altindaki dosyalar kabul edilir', () => {
    expect(isInsideAny(['/p/proj'], '/p/proj/src/App.tsx')).toBe(true)
    expect(isInsideAny([null, '/a', '/p/proj'], '/p/proj/x.ts')).toBe(true)
  })
  it('kok disi, kardes dizin, yol gecisi, kokun kendisi ve bos kok reddedilir', () => {
    expect(isInsideAny(['/p/proj'], '/etc/passwd')).toBe(false)
    expect(isInsideAny(['/p/proj'], '/p/proj-evil/x.ts')).toBe(false)
    expect(isInsideAny(['/p/proj'], '/p/proj/../secret')).toBe(false)
    expect(isInsideAny(['/p/proj'], '/p/proj')).toBe(false)
    expect(isInsideAny([null, undefined], '/p/proj/x')).toBe(false)
    expect(isInsideAny(['/p/proj'], '')).toBe(false)
  })
})
