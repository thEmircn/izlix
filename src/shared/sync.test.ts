import { describe, expect, it } from 'vitest'
import { isPayload, mergeBookmarks, mergeNotes, mergeSites, pickSettings } from './sync'

describe('sync birlestirme', () => {
  it('yer imleri: tekil, yeni olan kazanir', () => {
    const m = mergeBookmarks([{ url: 'a', title: 'A', ts: 1 }, { url: 'b', title: 'B', ts: 5 }], [{ url: 'a', title: 'A2', ts: 3 }, { url: 'b', title: 'B2', ts: 2 }, { url: 'c', title: 'C', ts: 1 }])
    expect(m.map((x) => x.title)).toEqual(['A2', 'B', 'C'])
  })
  it('notlar kimlige gore', () => {
    const n = (id: string, ts: number) => ({ id, url: 'u', text: 't', prefix: '', suffix: '', color: 'yellow', ts })
    expect(mergeNotes([n('1', 1)], [n('1', 2), n('2', 1)]).map((x) => `${x.id}:${x.ts}`).sort()).toEqual(['1:2', '2:1'])
  })
  it('site ayarlari: yerel korunur', () => { expect(mergeSites({ x: 1 }, { x: 2, y: 3 })).toEqual({ x: 1, y: 3 }) })
  it('ayar secimi hassas anahtarlari disarida birakir', () => {
    expect(pickSettings({ language: 'tr', ai: { provider: 'x' }, installId: 'i', telemetry: 'granted', adblock: 'ads' })).toEqual({ language: 'tr', adblock: 'ads' })
  })
  it('payload dogrulama', () => {
    expect(isPayload({ v: 1, ts: 1, device: 'd', bookmarks: {}, notes: [], sites: {}, settings: {} })).toBe(true)
    expect(isPayload({ v: 2 })).toBe(false); expect(isPayload(null)).toBe(false)
  })
})
