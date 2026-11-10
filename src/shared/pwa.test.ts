import { describe, expect, it } from 'vitest'
import { installability, installable, mergeSw, parseManifest } from './pwa'

const good = JSON.stringify({ name: 'App', short_name: 'A', start_url: '/', display: 'standalone', theme_color: '#fff', icons: [{ src: '/i192.png', sizes: '192x192' }, { src: '/i512.png', sizes: '512x512', purpose: 'any maskable' }] })
describe('manifest', () => {
  it('ayristirma ve gecersiz giris', () => {
    const m = parseManifest(good)!; expect(m.name).toBe('App'); expect(m.icons).toHaveLength(2); expect(m.display).toBe('standalone')
    expect(parseManifest('nope')).toBeNull(); expect(parseManifest(undefined)).toBeNull()
  })
  it('kurulabilirlik: tam manifest gecer, eksikler isaretlenir', () => {
    const c = installability(parseManifest(good)); expect(installable(c)).toBe(true); expect(c.every((x) => x.ok)).toBe(true)
    const bad = installability(parseManifest(JSON.stringify({ name: 'X', display: 'browser', icons: [{ src: 'a.png', sizes: '48x48' }] })))
    expect(installable(bad)).toBe(false)
    expect(bad.filter((x) => !x.ok).map((x) => x.id)).toEqual(['startUrl', 'display', 'icon192', 'icon512', 'maskable', 'theme'])
    expect(installable(installability(null))).toBe(false)
  })
})
describe('mergeSw', () => {
  it('silinenler ve redundant surumler elenir, aktif surum secilir', () => {
    const v = mergeSw(
      [{ registrationId: 'r1', scopeURL: 'http://a/', isDeleted: false }, { registrationId: 'r2', scopeURL: 'http://a/old/', isDeleted: true }, { registrationId: 'r3', scopeURL: 'http://a/new/', isDeleted: false }],
      [{ versionId: '1', registrationId: 'r1', scriptURL: 'http://a/sw.js', runningStatus: 'running', status: 'redundant' }, { versionId: '2', registrationId: 'r1', scriptURL: 'http://a/sw.js', runningStatus: 'running', status: 'activated', controlledClients: ['c1', 'c2'] }, { versionId: '3', registrationId: 'r1', scriptURL: 'http://a/sw.js', runningStatus: 'stopped', status: 'installed' }]
    )
    expect(v).toHaveLength(2); expect(v[0]).toMatchObject({ status: 'activated', running: 'running', clients: 2 }); expect(v[0].versions.map((x) => x.id)).toEqual(['3', '2'])
    expect(v[1]).toMatchObject({ registrationId: 'r3', status: 'new' })
  })
})
