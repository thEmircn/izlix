import { describe, expect, it } from 'vitest'
import { execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { crc32, makeZip } from './zip'

describe('zip', () => {
  it('crc32 bilinen degerle eslesir', () => { expect(crc32(Buffer.from('123456789'))).toBe(0xcbf43926) })
  it('sistem unzip ile dogrulanir ve icerik birebir cikar', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'))
    const big = Buffer.from('satir\n'.repeat(5000))
    writeFileSync(join(dir, 'a.zip'), makeZip([{ name: 'a.txt', data: Buffer.from('merhaba') }, { name: 'sub/b.ndjson', data: big }]))
    execFileSync('unzip', ['-tq', join(dir, 'a.zip')])
    execFileSync('unzip', ['-qo', join(dir, 'a.zip'), '-d', dir])
    expect(readFileSync(join(dir, 'a.txt'), 'utf8')).toBe('merhaba')
    expect(readFileSync(join(dir, 'sub/b.ndjson')).equals(big)).toBe(true)
  })
})
