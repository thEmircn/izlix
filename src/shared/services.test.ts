import { describe, expect, it } from 'vitest'
import { DEFAULT_HUB, nextUnread, parseUnread, serviceById, serviceForUrl, serviceUrl } from './services'

describe('hub servisleri', () => {
  it('okunmamis sayisi basliktan', () => {
    expect(parseUnread('(3) WhatsApp')).toBe(3); expect(parseUnread('(12) YouTube')).toBe(12); expect(parseUnread('(99+) Telegram Web')).toBe(99)
    expect(parseUnread('3 unread messages')).toBe(3); expect(parseUnread('WhatsApp')).toBe(0); expect(parseUnread('Foo (3)')).toBe(0)
  })
  it('ozel adres tamamlanir, bos ise null', () => {
    const y = serviceById('youtrack')!
    expect(serviceUrl(y, DEFAULT_HUB)).toBeNull()
    expect(serviceUrl(y, { ...DEFAULT_HUB, urls: { youtrack: 'acme.youtrack.cloud' } })).toBe('https://acme.youtrack.cloud/')
    expect(serviceUrl(serviceById('whatsapp')!, DEFAULT_HUB)).toBe('https://web.whatsapp.com/')
  })
  it('adresten servis', () => {
    expect(serviceForUrl('https://web.whatsapp.com/x', DEFAULT_HUB)?.id).toBe('whatsapp')
    expect(serviceForUrl('https://acme.youtrack.cloud/issues', { ...DEFAULT_HUB, urls: { youtrack: 'acme.youtrack.cloud' } })?.id).toBe('youtrack')
    expect(serviceForUrl('https://example.com', DEFAULT_HUB)).toBeUndefined()
  })
  it('siradaki okunmamis', () => {
    const l = [{ id: 'a', unread: 1 }, { id: 'b', unread: 5 }, { id: 'c', unread: 0 }]
    expect(nextUnread(l)).toBe('b'); expect(nextUnread(l, 'b')).toBe('a'); expect(nextUnread(l, 'a')).toBe('b'); expect(nextUnread([{ id: 'x', unread: 0 }])).toBeNull()
  })
})
