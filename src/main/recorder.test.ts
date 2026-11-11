import { describe, expect, it } from 'vitest'
import { parseStep } from './recorder'
describe('parseStep (sayfadan gelen veri dogrulanir)', () => {
  it('gecerli adimlari kabul eder', () => {
    expect(parseStep({ t: 'click', sel: { k: 'role', role: 'button', name: 'Gir' } })).toEqual({ t: 'click', sel: { k: 'role', role: 'button', name: 'Gir' } })
    expect(parseStep({ t: 'fill', sel: { k: 'placeholder', v: 'E' }, value: 'x' })).toEqual({ t: 'fill', sel: { k: 'placeholder', v: 'E' }, value: 'x' })
    expect(parseStep({ t: 'press', sel: { k: 'css', v: 'input' }, key: 'Enter' })).toMatchObject({ key: 'Enter' })
  })
  it('sifre alanlarinin degeri atilir; bilinmeyen tur/anahtar/secici reddedilir; asiri uzun yok sayilir', () => {
    expect(parseStep({ t: 'fill', sel: { k: 'label', v: 'S' }, value: 'gizli', secret: true })).toEqual({ t: 'fill', sel: { k: 'label', v: 'S' }, value: '', secret: true })
    expect(parseStep({ t: 'eval', sel: { k: 'css', v: 'x' } })).toBeNull(); expect(parseStep({ t: 'press', sel: { k: 'css', v: 'x' }, key: 'F12' })).toBeNull()
    expect(parseStep({ t: 'click', sel: { k: 'xpath', v: '//' } })).toBeNull(); expect(parseStep({ t: 'click', sel: { k: 'css', v: 'x'.repeat(400) } })).toBeNull(); expect(parseStep(null)).toBeNull()
  })
})
