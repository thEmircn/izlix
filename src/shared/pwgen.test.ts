import { describe, expect, it } from 'vitest'
import { generatePassword, isWeak, parseRange, strengthBits } from './pwgen'
const seq = (): ((m: number) => number) => { let s = 1; return (m) => { s = (s * 1103515245 + 12345) & 0x7fffffff; return s % m } }
describe('pwgen', () => {
  it('uzunluk sinirlari, secili siniflar en az bir kez, belirsiz karakter yok', () => {
    const p = generatePassword({ length: 24 }, seq())
    expect(p).toHaveLength(24); expect(/[a-z]/.test(p) && /[A-Z]/.test(p) && /\d/.test(p) && /[^A-Za-z0-9]/.test(p)).toBe(true); expect(/[0Ol1I]/.test(p)).toBe(false)
    expect(generatePassword({ length: 3 }, seq())).toHaveLength(8); expect(generatePassword({ length: 999 }, seq())).toHaveLength(128)
    expect(/^[a-z]+$/.test(generatePassword({ upper: false, digits: false, symbols: false }, seq()))).toBe(true)
  })
  it('gercek rastgelelik: iki parola farkli', () => { expect(generatePassword()).not.toBe(generatePassword()) })
  it('guc: kisa/yaygin zayif, uzun/cesitli guclu', () => {
    expect(isWeak('123456')).toBe(true); expect(isWeak('password1')).toBe(true); expect(isWeak('aaaaaaaaaa')).toBe(true); expect(isWeak('sifre2024')).toBe(true)
    expect(isWeak(generatePassword({ length: 20 }))).toBe(false); expect(strengthBits('')).toBe(0); expect(strengthBits('Xk9#mQ2$vL7!pR4&')).toBeGreaterThan(80)
  })
  it('HIBP yaniti ayristirma', () => {
    const t = '0018A45C4D1DEF81644B54AB7F969B88D65:10\r\n00D4F6E8FA6EECAD2A3AA415EEC418D38EC:2\n011053FD0102E94D6AE2F8B83D76FAF94F6:1'
    expect(parseRange(t, '00d4f6e8fa6eecad2a3aa415eec418d38ec')).toBe(2); expect(parseRange(t, 'FFFF')).toBe(0)
  })
})
