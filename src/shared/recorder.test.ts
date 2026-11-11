import { describe, expect, it } from 'vitest'
import { locator, tidySteps, toPlaywright, REC_SCRIPT, type Step } from './recorder'

describe('recorder', () => {
  it('konumlandirici: her secici turu icin dogru Playwright cagrisi, tirnak kacisi', () => {
    expect(locator({ k: 'testid', v: 'go' })).toBe("page.getByTestId('go')")
    expect(locator({ k: 'role', role: 'button', name: "It's" })).toBe("page.getByRole('button', { name: 'It\\'s' })")
    expect(locator({ k: 'css', v: 'form > input:nth-of-type(2)' })).toBe("page.locator('form > input:nth-of-type(2)')")
    expect(locator({ k: 'text', v: 'Merhaba' })).toBe("page.getByText('Merhaba', { exact: true })")
  })
  it('sadelestirme: fill oncesi tiklama atilir, ust uste fill birlesir, fill sonrasi Tab atilir', () => {
    const s: Step[] = [{ t: 'click', sel: { k: 'placeholder', v: 'E' } }, { t: 'fill', sel: { k: 'placeholder', v: 'E' }, value: 'a' }, { t: 'fill', sel: { k: 'placeholder', v: 'E' }, value: 'ab' }, { t: 'press', sel: { k: 'placeholder', v: 'E' }, key: 'Tab' }, { t: 'click', sel: { k: 'role', role: 'button', name: 'Giris' } }]
    expect(tidySteps(s)).toEqual([{ t: 'fill', sel: { k: 'placeholder', v: 'E' }, value: 'ab' }, { t: 'click', sel: { k: 'role', role: 'button', name: 'Giris' } }])
  })
  it('Playwright dosyasi: goto/fill/click; sifre degeri ASLA yazilmaz', () => {
    const code = toPlaywright([{ t: 'goto', url: 'http://a.com/' }, { t: 'fill', sel: { k: 'label', v: 'Sifre' }, value: 'gizli', secret: true }, { t: 'fill', sel: { k: 'label', v: 'Ad' }, value: 'ali' }, { t: 'click', sel: { k: 'role', role: 'button', name: 'Gir' } }], 'giris')
    expect(code).toContain("import { test, expect } from '@playwright/test';"); expect(code).toContain("test('giris'"); expect(code).toContain("await page.goto('http://a.com/');")
    expect(code).toContain("process.env.PASSWORD"); expect(code).not.toContain('gizli'); expect(code).toContain(".fill('ali')"); expect(code).toContain(".click();")
  })
  it('sayfa betigi gecerli JavaScript', () => { expect(() => new Function(REC_SCRIPT)).not.toThrow() })
})
