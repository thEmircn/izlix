import { describe, expect, it } from 'vitest'
import { listed, lookalike, mixedScript, parseHostList, registrable, threatOf } from './threat'

describe('tehdit listesi', () => {
  it('hostfile ayristirma', () => {
    const s = parseHostList('# yorum\n127.0.0.1\tbad.example\n127.0.0.1 evil.test # x\n\nnot a host\nplain.example')
    expect([...s].sort()).toEqual(['bad.example', 'evil.test', 'plain.example'])
  })
  it('ust alan adi eslesmesi', () => { const s = new Set(['bad.example']); expect(listed(s, 'a.b.bad.example')).toBe(true); expect(listed(s, 'good.example')).toBe(false); expect(listed(s, 'example')).toBe(false) })
  it('kayitli alan adi', () => { expect(registrable('a.b.example.com.tr')).toBe('example.com.tr'); expect(registrable('x.y.com')).toBe('y.com') })
})
describe('taklit alan adi', () => {
  it('yakalar', () => {
    expect(lookalike('paypal-giris.com')?.brand).toBe('paypal'); expect(lookalike('gooogle.com')?.brand).toBe('google'); expect(lookalike('paypa1.com')?.brand).toBe('paypal')
    expect(lookalike('paypal.com.evil.io')?.brand).toBe('paypal'); expect(lookalike('micros0ft.com')?.brand).toBe('microsoft')
  })
  it('resmi ve ilgisiz alanlari yakalamaz', () => {
    for (const h of ['www.google.com', 'accounts.google.com', 'mail.google.com.tr', 'paypal.com', 'github.io', 'user.github.io', 'example.com', 'localhost.dev', 'applepie.com', 'trendyol.com', 'sub.garantibbva.com.tr']) expect(lookalike(h), h).toBeNull()
  })
})
describe('karisik yazi', () => {
  it('Kiril+Latin yakalanir, Turkce harf degil', () => { expect(mixedScript('pаypal.com')).toBe(true); expect(mixedScript('çiçek.com')).toBe(false); expect(mixedScript('яндекс.рф')).toBe(false) })
})
describe('threatOf', () => {
  it('turler', () => {
    const s = new Set(['bad.example'])
    expect(threatOf('https://x.bad.example/a', s)?.kind).toBe('malware'); expect(threatOf('https://paypa1.com', s)?.kind).toBe('lookalike')
    expect(threatOf('https://xn--pypal-4ve.com', s, 'pаypal.com')?.kind).toBe('idn')
    expect(threatOf('https://example.com', s)).toBeNull(); expect(threatOf('http://127.0.0.1:5173', s)).toBeNull(); expect(threatOf('http://localhost:3000', s)).toBeNull(); expect(threatOf('about:blank', s)).toBeNull()
  })
})
