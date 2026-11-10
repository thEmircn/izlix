import { describe, expect, it } from 'vitest'
import type { BusEvent } from './events'
import { buildConsoleRows } from './console'

const ev = (id: number, kind: BusEvent['kind'], payload: any, ts = id * 10): BusEvent => ({ id, tabId: 't', ts, kind, source: 's', payload, causeIds: [], links: [] })
describe('buildConsoleRows', () => {
  it('seviyeleri esler; console olmayan olaylari atlar', () => {
    const r = buildConsoleRows([ev(1, 'console', { level: 'warning', text: 'w' }), ev(2, 'request', {}), ev(3, 'console', { level: 'log', text: 'l' }), ev(4, 'console', { level: 'weird', text: 'x' })])
    expect(r.map((x) => x.level)).toEqual(['warn', 'log', 'log'])
  })
  it('ardisik ayni mesajlari sayar, arada baska varsa ayirir', () => {
    const r = buildConsoleRows([ev(1, 'console', { level: 'log', text: 'a' }), ev(2, 'console', { level: 'log', text: 'a' }), ev(3, 'console', { level: 'log', text: 'a' }), ev(4, 'console', { level: 'log', text: 'b' }), ev(5, 'console', { level: 'log', text: 'a' })])
    expect(r.map((x) => [x.text, x.count])).toEqual([['a', 3], ['b', 1], ['a', 1]])
    expect(r[0].eventIds).toEqual([1, 2, 3])
  })
  it('istisna ve basarisiz ag istegi hata satiri olur; stack kareleri 1-bazli', () => {
    const r = buildConsoleRows([
      ev(1, 'error', { text: 'TypeError: x', stackTrace: { callFrames: [{ functionName: 'f', url: 'http://a/x.js', lineNumber: 4, columnNumber: 2 }] } }),
      ev(2, 'error', { requestId: 'r', url: 'http://a/api', errorText: 'net::ERR_FAILED' })
    ])
    expect(r[0]).toMatchObject({ level: 'error', source: 'exception', stack: [{ fn: 'f', line: 5, col: 3 }] })
    expect(r[1]).toMatchObject({ source: 'network', text: 'Failed to load http://a/api: net::ERR_FAILED' })
  })
})
