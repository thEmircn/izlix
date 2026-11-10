import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({ app: { getPath: () => '/tmp' } }))
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { WorkspaceStore } from './workspace'

const mk = (): WorkspaceStore => new WorkspaceStore(mkdtempSync(join(tmpdir(), 'ws-')))
describe('WorkspaceStore', () => {
  it('yeniden adlandirir; bos ad ve bilinmeyen kimlik reddedilir', () => {
    const s = mk(); const w = s.create('A', '/p/a')
    expect(s.rename(w.id, '  Yeni  ')).toBe(true)
    expect(s.get(w.id)!.name).toBe('Yeni')
    expect(s.rename(w.id, '   ')).toBe(false)
    expect(s.rename('yok', 'x')).toBe(false)
  })
  it('siler; default silinemez', () => {
    const s = mk(); const w = s.create('A', '/p/a')
    expect(s.remove('default')).toBe(false)
    expect(s.remove(w.id)).toBe(true)
    expect(s.get(w.id)).toBeUndefined()
    expect(s.remove(w.id)).toBe(false)
  })
  it('ayni klasor ayni Workspace; en uzun kok eslesir', () => {
    const s = mk(); const a = s.create('A', '/p'); const b = s.create('B', '/p/sub')
    expect(s.create('X', '/p').id).toBe(a.id)
    expect(s.workspaceForCwd('/p/sub/app')!.id).toBe(b.id)
    expect(s.workspaceForCwd('/p/other')!.id).toBe(a.id)
    expect(s.workspaceForCwd('/q')).toBeUndefined()
  })
})
