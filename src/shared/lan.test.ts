import { describe, expect, it } from 'vitest'
import { lanUrl, pickLanIp } from './lan'
const i = (address: string, internal = false, family: string | number = 'IPv4') => ({ address, internal, family })
describe('lan', () => {
  it('pickLanIp: ozel IPv4; 192.168 oncelikli; loopback/IPv6/genel yok sayilir', () => {
    expect(pickLanIp({ lo0: [i('127.0.0.1', true)], en0: [i('fe80::1', false, 'IPv6'), i('10.0.0.5')], en1: [i('192.168.1.20')] })).toBe('192.168.1.20')
    expect(pickLanIp({ en0: [i('10.0.0.5')], utun: [i('172.20.1.1')] })).toBe('10.0.0.5')
    expect(pickLanIp({ en0: [i('8.8.8.8')], lo0: [i('127.0.0.1', true)] })).toBeNull(); expect(pickLanIp({})).toBeNull()
    expect(pickLanIp({ en0: [i('192.168.0.9', false, 4)] })).toBe('192.168.0.9')
  })
  it('lanUrl: yalniz loopback adresleri; port/yol/sorgu korunur', () => {
    expect(lanUrl('http://localhost:5173/a?b=1#c', '192.168.1.20')).toBe('http://192.168.1.20:5173/a?b=1#c')
    expect(lanUrl('http://127.0.0.1:3000/', '10.0.0.5')).toBe('http://10.0.0.5:3000/')
    expect(lanUrl('https://example.com/', '10.0.0.5')).toBeNull(); expect(lanUrl('file:///x', '10.0.0.5')).toBeNull(); expect(lanUrl('nonsense', '10.0.0.5')).toBeNull()
  })
})
