import { describe, expect, it } from 'vitest'
import { EventBus } from './bus'
import { Correlator, type SourceLookup } from './correlate'

// Taklit kaynak cozumleyici: App tipi (id 1) src/App.tsx:10'da tanimli, Boom (id 2) :30'da
function fakeSrc(): SourceLookup {
  const components = new Map([
    [1, { file: '/p/src/App.tsx', line: 10, column: 1, name: 'App' }],
    [2, { file: '/p/src/App.tsx', line: 30, column: 1, name: 'Boom' }]
  ])
  return {
    components,
    settled: async () => {},
    resolveType: async (id) => components.get(id) ?? null,
    firstAppFrame: async (stack) => stack?.loc ?? null,
    componentAt: (file, line) => [...components.values()].filter((c) => c.file === file && c.line <= line).sort((a, b) => b.line - a.line)[0] ?? null
  }
}

const tick = () => new Promise((r) => setTimeout(r, 0))
function setup() {
  let now = 0
  const bus = new EventBus(() => now)
  const c = new Correlator(bus, fakeSrc())
  const at = (t: number) => { now = t }
  const input = (pageId: number, ts: number) => bus.emit({ tabId: 't', kind: 'input', source: 'bridge:input', ts, payload: { inputId: pageId } })
  const request = (url: string, ts: number, stack?: any) => bus.emit({ tabId: 't', kind: 'request', source: 'cdp:Network.requestWillBeSent', ts, payload: { requestId: 'r' + ts, url, type: 'Fetch', initiator: { stack } } })
  const response = (reqId: string, url: string, ts: number) => bus.emit({ tabId: 't', kind: 'response', source: 'cdp:Network.responseReceived', ts, payload: { requestId: reqId, url, type: 'Fetch', status: 200 } })
  const commit = (ts: number, p: object) => bus.emit({ tabId: 't', kind: 'render', source: 'bridge:commit', ts, payload: { components: [{ name: 'App', t: 1 }], ...p } })
  return { bus, c, at, input, request, response, commit }
}

describe('Correlator', () => {
  it('yalnizca kendi sekmesinin olaylarini isler (sekmeler arasi kirlenme yok)', async () => {
    const bus = new EventBus(() => 0)
    let resolvedByB = 0
    const srcB = { ...fakeSrc(), firstAppFrame: async () => { resolvedByB++; return { file: '/yanlis.tsx', line: 1, column: 1 } } }
    new Correlator(bus, srcB, 'B')
    const a = bus.emit({ tabId: 'A', kind: 'request', source: 'cdp:Network.requestWillBeSent', payload: { requestId: 'r', url: 'u', initiator: { stack: {} } } })
    await tick(); await tick()
    expect(resolvedByB).toBe(0)
    expect(bus.get(a.id)!.payload.origin).toBeUndefined()
  })

  it('girdi -> istek ve girdi -> render baglarini KESIN kurar', async () => {
    const { c, input, request, commit } = setup()
    const i = input(1, 100)
    c.onFetchStart('http://x/api', 1)
    const r = request('http://x/api', 101)
    const k = commit(102, { inputId: 1 })
    expect(r.links).toEqual([{ from: i.id, certainty: 'exact', type: 'input→request' }])
    expect(k.links).toEqual([{ from: i.id, certainty: 'exact', type: 'input→state' }])
  })

  it('istek -> yanit KESIN, yanit -> render TAHMINI baglanir ve yanit bir kez kullanilir', async () => {
    const { input, request, response, commit } = setup()
    input(1, 100)
    const r = request('http://x/api', 101)
    const res = response(r.payload.requestId, 'http://x/api', 200)
    const k1 = commit(250, {}), k2 = commit(260, {})
    expect(res.links[0]).toMatchObject({ from: r.id, certainty: 'exact' })
    expect(k1.links).toEqual([{ from: res.id, certainty: 'estimated', type: 'response→render' }])
    expect(k2.links).toEqual([])
  })

  it('yanittan 1 sn sonraki commit baglanmaz', () => {
    const { response, commit } = setup()
    response('r', 'http://x', 100)
    expect(commit(1200, {}).links).toEqual([])
  })

  it('girdiyle tetiklenen commit yaniti tuketmez', () => {
    const { response, commit } = setup()
    const res = response('r', 'http://x', 100)
    const input = commit(150, { inputId: 7 }) // bilinmeyen girdi: baglanmaz ama yanit tuketilmez
    const k = commit(160, {})
    expect(input.links).toEqual([])
    expect(k.links[0]).toMatchObject({ from: res.id, certainty: 'estimated' })
  })

  it('istek kaynagini stack -> dosya:satir -> en yakin onceki component olarak cozer', async () => {
    const { bus, request } = setup()
    const r = request('http://x/api', 100, { loc: { file: '/p/src/App.tsx', line: 14, column: 3 } })
    await tick(); await tick()
    expect(bus.get(r.id)!.payload.origin).toMatchObject({ file: '/p/src/App.tsx', line: 14, component: 'App' })
  })

  it('render -> hata: stack componenti commit kaydindaysa KESIN, degilse TAHMINI', async () => {
    const { bus, commit } = setup()
    const withBoom = commit(100, { components: [{ name: 'Boom', t: 2 }] })
    const err = bus.emit({ tabId: 't', kind: 'error', source: 'cdp:Runtime.exceptionThrown', ts: 110, payload: { stackTrace: { loc: { file: '/p/src/App.tsx', line: 31, column: 1 } } } })
    await tick(); await tick()
    expect(bus.get(err.id)!.links).toEqual([{ from: withBoom.id, certainty: 'exact', type: 'render→error' }])

    const other = commit(200, { components: [{ name: 'App', t: 1 }] })
    const err2 = bus.emit({ tabId: 't', kind: 'error', source: 'cdp:Runtime.exceptionThrown', ts: 210, payload: { stackTrace: { loc: { file: '/p/src/App.tsx', line: 12, column: 1 } } } })
    await tick(); await tick()
    expect(bus.get(err2.id)!.links[0]).toMatchObject({ from: other.id, certainty: 'exact' }) // App, son commit'te var
    const err3 = bus.emit({ tabId: 't', kind: 'error', source: 'cdp:Runtime.exceptionThrown', ts: 220, payload: { stackTrace: { loc: { file: '/p/src/App.tsx', line: 31, column: 1 } } } })
    await tick(); await tick()
    expect(bus.get(err3.id)!.links[0]).toMatchObject({ certainty: 'exact' }) // Boom, ilk commit'te
  })

  it('HMR bildirimi sonraki girdisiz render ile tahmini baglanir; yanit baglantisinin yerine gecer ve bir kez tuketilir', () => {
    const { bus, input, commit } = setup()
    void input
    const hmr = bus.emit({ tabId: 't', kind: 'hmr', source: 'hmr:vite', ts: 1000, payload: { action: 'update', file: '/src/App.tsx' } })
    const r1 = commit(1200, {})
    const r2 = commit(1300, {})
    expect(r1.links).toEqual([{ from: hmr.id, certainty: 'estimated', type: 'hmr→render' }])
    expect(r2.links).toEqual([]) // HMR yalnizca bir kez
  })

  it('HMR penceresi disindaki render baglanmaz; girdili render HMR ile baglanmaz', () => {
    const { bus, input, commit } = setup()
    bus.emit({ tabId: 't', kind: 'hmr', source: 'hmr:vite', ts: 1000, payload: { action: 'update' } })
    expect(commit(9000, {}).links).toEqual([])
    const bus2 = setup()
    bus2.bus.emit({ tabId: 't', kind: 'hmr', source: 'hmr:next', ts: 1000, payload: { action: 'done' } })
    bus2.input(7, 1100)
    const r = bus2.commit(1150, { inputId: 7 })
    expect(r.links.map((l) => l.type)).toEqual(['input→state'])
    void input
  })
})

