import { describe, expect, it } from 'vitest'
import type { BusEvent } from '../shared/events'
import { buildHar, buildSummary, consoleDump, toNdjson } from './report-data'

const ev = (id: number, kind: BusEvent['kind'], payload: any, o: Partial<BusEvent> = {}): BusEvent => ({ id, tabId: 't', ts: 1_700_000_000_000 + id * 100, kind, source: 's', payload, causeIds: [], links: [], ...o })
const jwt = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0In0.sig123'
const events = [
  ev(1, 'input', { name: 'click' }),
  ev(2, 'request', { requestId: 'r1', method: 'GET', url: `https://a.com/api?access_token=${jwt}`, modified: { kinds: ['mock'], mocked: true } }, { links: [{ from: 1, certainty: 'exact', type: 'input→request' }], causeIds: [1] }),
  ev(3, 'response', { requestId: 'r1', status: 500, mimeType: 'application/json' }),
  ev(4, 'error', { text: `Error: boom Authorization: Bearer ${jwt}` }, { links: [{ from: 2, certainty: 'estimated', type: 'x' }], causeIds: [2] }),
  ev(5, 'console', { level: 'error', text: 'oops', token: 'abc' })
]
const env = { url: 'http://localhost:5173/', title: 'T', workspace: 'W', app: 'izlix', electron: '45', chrome: '150', os: 'darwin', arch: 'arm64', generatedAt: 'now' }

describe('rapor', () => {
  it('HAR istek/yanit eslestirir ve token sizdirmaz', () => {
    const har: any = buildHar(events)
    expect(har.log.entries).toHaveLength(1)
    expect(har.log.entries[0].response.status).toBe(500)
    expect(JSON.stringify(har)).not.toContain(jwt)
  })
  it('NDJSON ve console dokumu maskeli', () => {
    expect(toNdjson(events)).not.toContain(jwt)
    expect(toNdjson(events).trim().split('\n')).toHaveLength(5)
    expect(JSON.stringify(consoleDump(events))).not.toContain('"abc"')
  })
  it('kullanici isaretleri rapora girer', () => { expect(buildSummary([ev(1, 'marker', { text: 'burada hata' })], env)).toContain('burada hata') })
  it('Web Vitals ozeti rapora girer', () => {
    const md = buildSummary([ev(1, 'navigation', {}, { source: 'cdp:Page.frameNavigated', ts: 10 } as any), ev(2, 'vital', { name: 'LCP', value: 3100 }), ev(3, 'vital', { name: 'longtask', value: 150, start: 1 })], env)
    expect(md).toContain('## Performans'); expect(md).toContain('LCP: 3100 ms (needs)'); expect(md).toContain('TBT: 100 ms')
  })
  it('ozet hatalari, basarisiz istekleri ve zinciri icerir', () => {
    const md = buildSummary(events, env)
    expect(md).toContain('2 hata')
    expect(md).toContain('1 başarısız')
    expect(md).toContain('Başarısız istekler')
    expect(md).toContain('input #1')
    expect(md).not.toContain(jwt)
  })
})
