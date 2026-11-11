import { describe, expect, it } from 'vitest'
import { isBootstrapped, TorService } from './tor'

describe('TorService', () => {
  it('calisan sistem SOCKS portunu bulur', async () => {
    const t = new TorService('/tmp/x', async (p) => p === 9150, [], 100)
    expect(await t.ensure()).toEqual({ ok: true, port: 9150, own: false })
  })
  it('port yok ve ikili yoksa missing doner', async () => {
    const t = new TorService('/tmp/x', async () => false, ['/yok/tor'], 100, () => false)
    expect(await t.ensure()).toEqual({ ok: false, reason: 'missing' })
  })
  it('eszamanli cagrilar tek baslatmayi paylasir', async () => {
    let n = 0
    const t = new TorService('/tmp/x', async () => { n++; return true }, [], 100)
    await Promise.all([t.ensure(), t.ensure(), t.ensure()])
    expect(n).toBe(1)
  })
  it('bootstrap satirini taniyar', () => {
    expect(isBootstrapped('Nov 11 [notice] Bootstrapped 100% (done): Done')).toBe(true)
    expect(isBootstrapped('Bootstrapped 45% (loading_descriptors)')).toBe(false)
  })
})
