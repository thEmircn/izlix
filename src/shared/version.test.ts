import { describe, expect, it } from 'vitest'
import { isOlder, parseVer } from './version'
describe('surum', () => {
  it('karsilastirir', () => { expect(isOlder('45.2.3', '45.2.4')).toBe(true); expect(isOlder('45.2.3', '45.2.3')).toBe(false); expect(isOlder('46.0.0', '45.9.9')).toBe(false); expect(isOlder('45.10.0', '45.9.0')).toBe(false); expect(isOlder('x', '1.0.0')).toBe(false) })
  it('ayristirir', () => { expect(parseVer('v45.2.3-beta')).toEqual([45, 2, 3]); expect(parseVer('abc')).toBeNull() })
})
