import { describe, expect, it } from 'vitest'
import { trAudit } from './audit-tr'

describe('trAudit', () => {
  it('Turkce: bilinen mesajlar ceviri alir, parametreler korunur', () => {
    expect(trAudit('Image has no alt attribute', 'tr')).toBe('Görselde alt özniteliği yok')
    expect(trAudit('Heading level jumps from h2 to h4', 'tr')).toBe("Başlık seviyesi h2'den h4'ye atlıyor")
    expect(trAudit('Contrast 2.50:1 (needs 4.5:1)', 'tr')).toBe('Kontrast 2.50:1 (gereken 4.5:1)')
    expect(trAudit('Click target is 20×18px (min 24×24)', 'tr')).toBe('Tıklama hedefi 20×18px (en az 24×24)')
  })
  it('Ingilizce ve bilinmeyen mesaj aynen kalir', () => {
    expect(trAudit('Image has no alt attribute', 'en')).toBe('Image has no alt attribute')
    expect(trAudit('Something else', 'tr')).toBe('Something else')
  })
})
