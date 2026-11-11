// Durum (state) koprusu: Redux DevTools uzantisi protokolunu taklit eder; Redux, Redux Toolkit, Zustand (devtools), Jotai/Valtio devtools otomatik gorunur.
export const STATE_BINDING = '__dbState'

/** Sayfa betigi (belge basi). Yalnizca yerel gelistirme adreslerinde calisir; uretim sitelerine dokunmaz. Durum kopyasi derinlik/boyut sinirli, dongu guvenli. */
function stateBridgeInPage(binding: string): void {
  const h = location.hostname
  if (!(h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost') || h.endsWith('.local') || /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(h))) return
  const w = window as unknown as Record<string, any>
  if (w.__dbStateInit || w.__REDUX_DEVTOOLS_EXTENSION__) return
  w.__dbStateInit = true
  const send = (o: unknown): void => { try { if (w[binding]) w[binding](JSON.stringify(o)) } catch (e) { /* bozuk durum */ } }
  const clone = (v: unknown, depth: number, seen: unknown[]): unknown => {
    if (v === null || typeof v === 'number' || typeof v === 'boolean') return v
    if (typeof v === 'string') return v.length > 300 ? v.slice(0, 300) + '…' : v
    if (typeof v === 'undefined') return '[undefined]'
    if (typeof v === 'function') return '[fn]'
    if (typeof v === 'symbol' || typeof v === 'bigint') return String(v)
    if (depth > 6) return '[…]'
    if (seen.indexOf(v) >= 0) return '[circular]'
    seen.push(v)
    try {
      if (v instanceof Date) return v.toISOString()
      if (v instanceof Map) return { '[Map]': Array.from(v.entries()).slice(0, 40).map(([k, x]) => [clone(k, depth + 1, seen), clone(x, depth + 1, seen)]) }
      if (v instanceof Set) return { '[Set]': Array.from(v.values()).slice(0, 40).map((x) => clone(x, depth + 1, seen)) }
      if (Array.isArray(v)) { const a = v.slice(0, 50).map((x) => clone(x, depth + 1, seen)); if (v.length > 50) a.push('[+' + (v.length - 50) + ' more]'); return a }
      const o: Record<string, unknown> = {}; let n = 0
      for (const k of Object.keys(v as object)) { if (n++ >= 60) { o['…'] = '[+more keys]'; break } o[k] = clone((v as Record<string, unknown>)[k], depth + 1, seen) }
      return o
    } finally { seen.pop() }
  }
  let seq = 0
  const connect = (opts?: { name?: string; instanceId?: string | number }) => {
    const name = String((opts && (opts.name || opts.instanceId)) || 'store-' + ++seq)
    return {
      init(state: unknown): void { send({ t: 'init', store: name, state: clone(state, 0, []) }) },
      send(action: unknown, state: unknown): void { const a = action as { type?: string } | string; send({ t: 'action', store: name, action: typeof a === 'string' ? a : (a && a.type) || 'action', payload: typeof a === 'object' ? clone(a, 0, []) : undefined, state: clone(state, 0, []) }) },
      subscribe(): () => void { return function () { /* tek yonlu */ } }, unsubscribe(): void { /* yok */ }, error(): void { /* yok */ }
    }
  }
  const enhancer = (opts?: { name?: string }) => (createStore: (...a: any[]) => any) => (reducer: unknown, preloaded: unknown, enh: unknown) => {
    const store = createStore(reducer, preloaded, enh)
    const c = connect(opts); c.init(store.getState())
    const d = store.dispatch
    store.dispatch = (a: unknown) => { const r = d(a); try { c.send(a, store.getState()) } catch (e) { /* yok say */ } return r }
    return store
  }
  const ext: any = function (opts?: { name?: string }) { return enhancer(opts) }
  ext.connect = connect; ext.disconnect = (): void => {}; ext.send = (): void => {}; ext.listen = (): void => {}; ext.open = (): void => {}; ext.notifyErrorReport = (): void => {}; ext.updateStore = (): void => {}
  w.__REDUX_DEVTOOLS_EXTENSION__ = ext
  w.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__ = function (...args: any[]) {
    const opts = args.length === 1 && typeof args[0] === 'object' ? args[0] : undefined
    if (opts) return (...fns: any[]) => (createStore: any) => [...fns, enhancer(opts)].reduceRight((acc: any, f: any) => f(acc), createStore)
    const fns = args.filter((f) => typeof f === 'function')
    return fns.length ? (createStore: any) => [...fns, enhancer()].reduceRight((acc: any, f: any) => f(acc), createStore) : enhancer()
  }
}
export const STATE_SCRIPT = `(${stateBridgeInPage.toString()})(${JSON.stringify(STATE_BINDING)})`

/** Ust duzey anahtarlarda degisenler (sig karsilastirma; ilk durumda hepsi) */
export function changedKeys(prev: unknown, next: unknown): string[] {
  const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
  if (!isObj(next)) return prev === next ? [] : ['(root)']
  if (!isObj(prev)) return Object.keys(next)
  const keys = new Set([...Object.keys(prev), ...Object.keys(next)])
  return [...keys].filter((k) => JSON.stringify(prev[k]) !== JSON.stringify(next[k]))
}
