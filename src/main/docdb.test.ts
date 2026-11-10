import { afterEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { closeDocDbs, deleteDoc, listDocs, loadDoc, saveDoc } from './docdb'

const tmp = (): string => mkdtempSync(join(tmpdir(), 'docdb-'))
afterEach(() => closeDocDbs())

describe('docdb', () => {
  it('yaz-oku, ustune yaz, sil, listele', () => {
    const d = tmp()
    expect(loadDoc(d, 'x')).toBeUndefined()
    expect(saveDoc(d, 'x', { a: 1 })).toBe(true); expect(loadDoc(d, 'x')).toEqual({ a: 1 })
    saveDoc(d, 'x', { a: 2, b: [1, 2] }); expect(loadDoc(d, 'x')).toEqual({ a: 2, b: [1, 2] })
    saveDoc(d, 'y', 'metin'); expect(listDocs(d).map((r) => r.name)).toEqual(['x', 'y'])
    deleteDoc(d, 'x'); expect(loadDoc(d, 'x')).toBeUndefined()
  })
  it('eski JSON dosyasi ilk okumada iceri aktarilir ve yedeklenir; sonra veritabani kazanir', () => {
    const d = tmp(); writeFileSync(join(d, 'rules.json'), JSON.stringify({ w: { rules: [], domains: ['localhost'] } }))
    expect(loadDoc(d, 'rules')).toEqual({ w: { rules: [], domains: ['localhost'] } })
    expect(existsSync(join(d, 'rules.json'))).toBe(false); expect(existsSync(join(d, 'rules.json.migrated'))).toBe(true)
    saveDoc(d, 'rules', { changed: true }); closeDocDbs(); expect(loadDoc(d, 'rules')).toEqual({ changed: true })
  })
  it('bozuk eski dosya okumayi bozmaz', () => {
    const d = tmp(); writeFileSync(join(d, 'bad.json'), '{not json'); expect(loadDoc(d, 'bad')).toBeUndefined()
  })
  it('kalicilik: baglanti kapatilip yeniden acilinca veri durur', () => {
    const d = tmp(); saveDoc(d, 'k', { v: 'sakli' }); closeDocDbs(); expect(loadDoc(d, 'k')).toEqual({ v: 'sakli' })
  })
})
