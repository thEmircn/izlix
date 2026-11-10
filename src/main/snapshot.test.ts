import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({}))
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { BusEvent } from '../shared/events'
import { decodeSnapshot, encodeSnapshot, loadSnapshot, saveSnapshot } from './snapshot'

const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig123'
const ev: BusEvent[] = [{ id: 1, tabId: 't', ts: 1, kind: 'request', source: 's', payload: { url: `https://a.com/?access_token=${jwt}` }, causeIds: [], links: [] }]
describe('snapshot', () => {
  it('gzip gidis-donus; token maskeli', () => {
    const back = decodeSnapshot(encodeSnapshot(ev))
    expect(back).toHaveLength(1)
    expect(JSON.stringify(back)).not.toContain(jwt)
  })
  it('dosyaya yazar', () => {
    const f = saveSnapshot(join(mkdtempSync(join(tmpdir(), 'snap-')), 'x'), ev, new Date('2026-01-02T03:04:05Z'))
    expect(existsSync(f)).toBe(true)
    expect(f).toMatch(/timeline-2026-01-02T03-04-05\.ndjson\.gz$/)
    expect(readFileSync(f)[0]).toBe(0x1f)
  })
  it('loadSnapshot: gecersiz/yabanci satirlari eler', () => {
    const dir = join(mkdtempSync(join(tmpdir(), 'snap-')), 'x')
    const f = saveSnapshot(dir, [ev[0], { ...ev[0], id: 2, kind: 'evil' as any }, { ...ev[0], id: 3, links: undefined as any }])
    const got = loadSnapshot(f)
    expect(got.map((e) => e.id)).toEqual([1])
  })
})
