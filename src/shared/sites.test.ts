import { describe, expect, it } from 'vitest'
import { normalizeSite, siteHost, stepZoom } from './sites'
describe('sites', () => {
  it('siteHost yalniz http(s)', () => { expect(siteHost('https://WWW.Example.com/a')).toBe('www.example.com'); expect(siteHost('file:///x')).toBeNull(); expect(siteHost('x')).toBeNull() })
  it('stepZoom en yakin adimdan ilerler, uclarda kalir, reset 1', () => {
    expect(stepZoom(1, 'in')).toBe(1.1); expect(stepZoom(1, 'out')).toBe(0.9); expect(stepZoom(3, 'in')).toBe(3); expect(stepZoom(0.5, 'out')).toBe(0.5); expect(stepZoom(2, 'reset')).toBe(1)
    expect(stepZoom(1.12, 'in')).toBe(1.25)
  })
  it('normalizeSite varsayilanlari atar', () => {
    expect(normalizeSite({ zoom: 1, dark: false, css: '  ' })).toBeNull()
    expect(normalizeSite({ zoom: 1.25, dark: true, css: 'a{}' })).toEqual({ zoom: 1.25, dark: true, css: 'a{}' })
    expect(normalizeSite({ zoom: 99 })).toBeNull()
  })
})
