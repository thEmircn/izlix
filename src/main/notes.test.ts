import { describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { NoteStore } from './notes'
import { pageKey } from '../shared/notes'

describe('NoteStore / pageKey', () => {
  it('pageKey hash atar, yalniz http(s)', () => { expect(pageKey('https://a.com/p?q=1#x')).toBe('https://a.com/p?q=1'); expect(pageKey('file:///x')).toBeNull(); expect(pageKey('x')).toBeNull() })
  it('ekle/liste/guncelle/sil; ayni vurgu tekrar eklenmez; sayfaya gore', () => {
    const s = new NoteStore(mkdtempSync(join(tmpdir(), 'notes-')))
    const a = s.add('https://a.com/p#h', { text: 'kedi', prefix: 'bir ', suffix: ' var' }, 'not', 'green', 1000)!
    expect(a.url).toBe('https://a.com/p'); expect(s.add('https://a.com/p', { text: 'kedi', prefix: 'bir ', suffix: '' })!.id).toBe(a.id)
    s.add('https://b.com/', { text: 'kopek', prefix: '', suffix: '' }, undefined, 'yellow', 2000)
    expect(s.forPage('https://a.com/p?x')).toHaveLength(0); expect(s.forPage('https://a.com/p#zz')).toHaveLength(1); expect(s.all().map((n) => n.text)).toEqual(['kopek', 'kedi'])
    expect(s.update(a.id, { note: '' })!.note).toBeUndefined(); expect(s.update(a.id, { note: 'yeni', color: 'pink' })).toMatchObject({ note: 'yeni', color: 'pink' })
    expect(s.remove(a.id)!.id).toBe(a.id); expect(s.remove(a.id)).toBeNull(); expect(s.add('about:blank', { text: 'x', prefix: '', suffix: '' })).toBeNull()
    s.flush(); expect(new NoteStore((s as any).dir).all()).toHaveLength(1) // kalicilik
  })
})
