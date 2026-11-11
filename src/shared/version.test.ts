import { describe, expect, it } from 'vitest'
import { compareVersions, isOlder, latestTagged, parseVer } from './version'
describe('surum', () => {
  it('karsilastirir', () => { expect(isOlder('45.2.3', '45.2.4')).toBe(true); expect(isOlder('45.2.3', '45.2.3')).toBe(false); expect(isOlder('46.0.0', '45.9.9')).toBe(false); expect(isOlder('45.10.0', '45.9.0')).toBe(false); expect(isOlder('x', '1.0.0')).toBe(false) })
  it('ayristirir', () => { expect(parseVer('v45.2.3-beta')).toEqual([45, 2, 3]); expect(parseVer('abc')).toBeNull() })
})

describe('compareVersions', () => {
  it('cekirdek ve on-surum siralamasi', () => {
    expect(compareVersions('0.1.0', '0.1.1')).toBe(-1); expect(compareVersions('1.0.0', '0.9.9')).toBe(1); expect(compareVersions('0.1.0', '0.1.0')).toBe(0)
    expect(compareVersions('0.1.0-alpha.1', '0.1.0')).toBe(-1); expect(compareVersions('0.1.0', '0.1.0-rc.1')).toBe(1)
    expect(compareVersions('0.1.0-alpha.2', '0.1.0-alpha.10')).toBe(-1); expect(compareVersions('0.1.0-alpha.1', '0.1.0-beta.1')).toBe(-1)
    expect(compareVersions('0.1.0-alpha', '0.1.0-alpha.1')).toBe(-1); expect(compareVersions('v1.2.3', '1.2.3')).toBe(0); expect(compareVersions('x', '1.0.0')).toBeNull()
  })
  it('latestTagged: onek ve en yeni surum', () => {
    expect(latestTagged(['ext-v0.1.0-alpha.1', 'ext-v0.1.0', 'browser-v9.9.9', 'ext-vjunk', 'ext-v0.0.9'], 'ext-v')).toEqual({ version: '0.1.0', tag: 'ext-v0.1.0' })
    expect(latestTagged(['browser-v1.0.0'], 'ext-v')).toBeNull()
  })
})
