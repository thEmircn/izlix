import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { originOf, PermissionStore, permissionKey } from './permissions'

describe('permissionKey', () => {
  it('denetim islemcisi tekil mediaType verir', () => {
    expect(permissionKey('media', { mediaType: 'video' })).toBe('camera'); expect(permissionKey('media', { mediaType: 'audio' })).toBe('microphone'); expect(permissionKey('media', { mediaType: 'unknown' })).toBeNull()
  })
  it('media: video->camera, audio->microphone; bilinmeyen null; otomatik izinler', () => {
    expect(permissionKey('media', { mediaTypes: ['video'] })).toBe('camera'); expect(permissionKey('media', { mediaTypes: ['audio'] })).toBe('microphone'); expect(permissionKey('media', {})).toBeNull()
    expect(permissionKey('geolocation')).toBe('geolocation'); expect(permissionKey('clipboard-sanitized-write')).toBe('auto'); expect(permissionKey('fullscreen')).toBe('auto')
    for (const p of ['openExternal', 'usb', 'hid', 'serial', 'sensors', 'unknown-thing']) expect(permissionKey(p)).toBeNull()
  })
})
describe('PermissionStore', () => {
  it('kalici karar, kaldirma, liste; origin bazli', () => {
    const dir = mkdtempSync(join(tmpdir(), 'perm-'))
    const s = new PermissionStore(dir)
    expect(s.get('http://a.com', 'camera')).toBeUndefined()
    s.set('http://a.com', 'camera', 'allow'); s.set('http://b.com', 'camera', 'deny')
    expect(new PermissionStore(dir).get('http://a.com', 'camera')).toBe('allow')
    expect(s.get('http://b.com', 'camera')).toBe('deny'); expect(s.get('http://a.com', 'microphone')).toBeUndefined()
    expect(s.list()).toHaveLength(2)
    s.remove('http://a.com', 'camera'); expect(s.list()).toEqual([{ origin: 'http://b.com', permission: 'camera', decision: 'deny' }])
  })
  it('originOf', () => { expect(originOf('https://a.com/x?y')).toBe('https://a.com'); expect(originOf('file:///x')).toBe(''); expect(originOf('garbage')).toBe('') })
})
