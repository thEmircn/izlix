import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { migrateLegacyData } from './migrate'

describe('migrateLegacyData', () => {
  it('eski klasoru ve veritabani dosyalarini yeni ada tasir', () => {
    const base = mkdtempSync(join(tmpdir(), 'mig-')); mkdirSync(join(base, 'izlix'))
    for (const s of ['', '-wal', '-shm']) writeFileSync(join(base, 'izlix', `izlix.db${s}`), 'x')
    expect(migrateLegacyData(base)).toBe('moved')
    expect(existsSync(join(base, 'izlix', 'izlix.db'))).toBe(true); expect(existsSync(join(base, 'izlix', 'izlix.db-wal'))).toBe(true)
    expect(existsSync(join(base, 'izlix'))).toBe(false)
  })
  it('yeni klasor varsa veya eski yoksa dokunmaz', () => {
    const a = mkdtempSync(join(tmpdir(), 'mig-')); mkdirSync(join(a, 'izlix')); mkdirSync(join(a, 'izlix'))
    expect(migrateLegacyData(a)).toBe('none'); expect(existsSync(join(a, 'izlix'))).toBe(true)
    expect(migrateLegacyData(mkdtempSync(join(tmpdir(), 'mig-')))).toBe('none')
  })
})
