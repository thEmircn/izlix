import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ net: {}, protocol: {} }))
import { resolveAppPath } from './security'

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
