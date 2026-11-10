import { describe, expect, it, vi } from 'vitest'
vi.mock('electron', () => ({}))
import { DebuggerService, urlRegexFor } from './debugger'

describe('urlRegexFor', () => {
  it('sorgu/hash atilir, regex ozel karakterleri kacirilir, sorguyla eslesir', () => {
    const re = new RegExp(urlRegexFor('http://localhost:5173/src/App.tsx?t=123#x'))
    expect(re.test('http://localhost:5173/src/App.tsx')).toBe(true); expect(re.test('http://localhost:5173/src/App.tsx?t=999')).toBe(true)
    expect(re.test('http://localhost:5173/src/AppXtsx')).toBe(false); expect(re.test('http://localhost:5173/src/App.tsx.map')).toBe(false)
  })
})
describe('DebuggerService', () => {
  const mk = () => {
    const cmds: [string, any][] = []; let listener: any
    const wc: any = { isDestroyed: () => false, debugger: { sendCommand: async (m: string, p: any) => { cmds.push([m, p]); if (m === 'Debugger.setBreakpointByUrl') return { breakpointId: 'bp1' }; if (m === 'Runtime.getProperties') return { result: [{ name: 'x', value: { type: 'number', value: 3 } }, { name: '__proto__', value: { type: 'object' } }, { name: 'o', value: { type: 'object', objectId: 'obj1', description: 'Object' } }] }; return {} }, on: (_: string, l: any) => { listener = l }, removeListener: vi.fn() } }
    const resolver: any = { holdDebugger: false, resolveFrame: async () => ({ file: '/p/App.tsx', line: 12 }), generatedFor: async (n: string, l: number) => (n === 'App.tsx' ? { url: 'http://a/main.js', line0: l + 100, col0: 4 } : null) }
    const events: any[] = []
    const svc = new DebuggerService(() => ({ wc, resolver }), (_id, e) => events.push(e))
    return { svc, cmds, events, resolver, fire: (m: string, p: any) => listener(null, m, p) }
  }
  it('etkinlestirme resolver.holdDebugger ayarlar; kapatma geri alir ve duraklamayi surdurur', async () => {
    const { svc, cmds, resolver } = mk()
    await svc.enable('t'); expect(resolver.holdDebugger).toBe(true); expect(cmds.map((c) => c[0])).toContain('Debugger.enable')
    await svc.disable('t'); expect(resolver.holdDebugger).toBe(false); expect(cmds.map((c) => c[0])).toEqual(expect.arrayContaining(['Debugger.resume', 'Debugger.disable']))
  })
  it('kesme noktasi: orijinal dosya source map ile uretilene cevrilir; esleme yoksa hata', async () => {
    const { svc, cmds } = mk()
    const ok: any = await svc.setBreakpoint('t', { file: 'App.tsx', line: 10 })
    expect(ok).toMatchObject({ id: 'bp1', url: 'http://a/main.js', line: 111 })
    expect(cmds.find((c) => c[0] === 'Debugger.setBreakpointByUrl')![1]).toMatchObject({ lineNumber: 110, columnNumber: 4 })
    expect(await svc.setBreakpoint('t', { file: 'Yok.tsx', line: 1 })).toEqual({ error: 'unmapped' })
    expect(await svc.setBreakpoint('t', { url: 'http://a/x.js', line: 5, condition: 'i > 2' })).toMatchObject({ line: 5 })
    expect(cmds.filter((c) => c[0] === 'Debugger.setBreakpointByUrl').pop()![1].condition).toBe('i > 2')
  })
  it('paused olayi: cerceveler orijinal konumla; resumed', async () => {
    const { svc, events, fire } = mk()
    await svc.enable('t')
    fire('Debugger.paused', { reason: 'other', hitBreakpoints: ['bp1'], callFrames: [{ callFrameId: 'f1', functionName: 'load', url: 'http://a/main.js', location: { scriptId: '1', lineNumber: 41, columnNumber: 2 }, scopeChain: [{ type: 'local', object: { objectId: 'o1' } }, { type: 'global', object: { objectId: 'g' } }] }] })
    await new Promise((r) => setTimeout(r, 10))
    expect(events[0]).toMatchObject({ type: 'paused', reason: 'other', hit: ['bp1'] })
    expect(events[0].frames[0]).toMatchObject({ id: 'f1', fn: 'load', line: 42, orig: { file: '/p/App.tsx', line: 12 } }); expect(events[0].frames[0].scopes).toHaveLength(1)
    fire('Debugger.resumed', {}); expect(events[1]).toEqual({ type: 'resumed' })
  })
  it('callFrame.url bos gelirse scriptParsed ile bilinen adres kullanilir', async () => {
    const { svc, events, fire } = mk()
    await svc.enable('t')
    fire('Debugger.scriptParsed', { scriptId: '9', url: 'http://a/app.js' })
    fire('Debugger.paused', { reason: 'other', callFrames: [{ callFrameId: 'f', functionName: '', url: '', location: { scriptId: '9', lineNumber: 2 }, scopeChain: [] }] })
    await new Promise((r) => setTimeout(r, 10))
    expect(events[0].frames[0]).toMatchObject({ url: 'http://a/app.js', fn: '(anonymous)', line: 3 })
  })
  it('kapsam degiskenleri: __proto__ atilir, nesneler genisletilebilir', async () => {
    const { svc } = mk()
    expect(await svc.scope('t', 'o1')).toEqual([{ name: 'x', text: '3', type: 'number', objectId: undefined }, { name: 'o', text: 'Object', type: 'object', objectId: 'obj1' }])
  })
})
