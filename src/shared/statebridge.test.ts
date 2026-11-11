import { describe, expect, it, vi } from 'vitest'
import { changedKeys, STATE_BINDING, STATE_SCRIPT } from './statebridge'

function run(host: string, preset = false) {
  const sent: any[] = []
  const win: any = { [STATE_BINDING]: (s: string) => sent.push(JSON.parse(s)) }
  if (preset) win.__REDUX_DEVTOOLS_EXTENSION__ = {}
  new Function('window', 'location', STATE_SCRIPT.replace(/^\(/, 'return (').replace(/\)\(.*$/s, (m) => m))(win, { hostname: host })
  return { win, sent }
}
describe('statebridge', () => {
  it('betik gecerli; yalniz yerel adreslerde kurulur; var olan uzantiya dokunmaz', () => {
    const f = new Function('window', 'location', `const fn = ${STATE_SCRIPT.slice(1, STATE_SCRIPT.indexOf(')(') )}; fn(${JSON.stringify(STATE_BINDING)})`)
    const win: any = {}; f(win, { hostname: 'example.com' }); expect(win.__REDUX_DEVTOOLS_EXTENSION__).toBeUndefined()
    const w2: any = {}; f(w2, { hostname: 'localhost' }); expect(typeof w2.__REDUX_DEVTOOLS_EXTENSION__).toBe('function'); expect(typeof w2.__REDUX_DEVTOOLS_EXTENSION_COMPOSE__).toBe('function')
    const w3: any = { __REDUX_DEVTOOLS_EXTENSION__: 'x' }; f(w3, { hostname: 'localhost' }); expect(w3.__REDUX_DEVTOOLS_EXTENSION__).toBe('x')
    void run; void vi
  })
  it('Zustand tarzi connect().init/send ve Redux tarzi enhancer olaylari bildirir (dongu guvenli, buyuk durum kirpilir)', () => {
    const f = new Function('window', 'location', `const fn = ${STATE_SCRIPT.slice(1, STATE_SCRIPT.indexOf(')(') )}; fn('__dbState')`)
    const sent: any[] = []; const win: any = { __dbState: (s: string) => sent.push(JSON.parse(s)) }; f(win, { hostname: '127.0.0.1' })
    const c = win.__REDUX_DEVTOOLS_EXTENSION__.connect({ name: 'cart' })
    const circ: any = { a: 1 }; circ.self = circ
    c.init({ items: [], circ }); c.send({ type: 'cart/add' }, { items: [1], big: 'x'.repeat(1000), fn: () => 1 })
    expect(sent[0]).toMatchObject({ t: 'init', store: 'cart' }); expect(sent[0].state.circ.self).toBe('[circular]')
    expect(sent[1]).toMatchObject({ t: 'action', store: 'cart', action: 'cart/add' }); expect(sent[1].state.big.length).toBeLessThan(310); expect(sent[1].state.fn).toBe('[fn]')
    // Redux tarzi: minik createStore
    const createStore = (reducer: any, pre: any, enh: any) => { if (enh) return enh(createStore)(reducer, pre); let s = reducer(pre, { type: '@@init' }); return { getState: () => s, dispatch: (a: any) => { s = reducer(s, a); return a } } }
    const reducer = (s = { n: 0 }, a: any) => (a.type === 'inc' ? { n: s.n + 1 } : s)
    const store = createStore(reducer, undefined, win.__REDUX_DEVTOOLS_EXTENSION__({ name: 'counter' }))
    store.dispatch({ type: 'inc' })
    const acts = sent.filter((x) => x.store === 'counter'); expect(acts[0]).toMatchObject({ t: 'init', state: { n: 0 } }); expect(acts[1]).toMatchObject({ t: 'action', action: 'inc', state: { n: 1 } })
  })
  it('changedKeys', () => {
    expect(changedKeys({ a: 1, b: { c: 1 } }, { a: 1, b: { c: 2 }, d: 1 }).sort()).toEqual(['b', 'd']); expect(changedKeys(undefined, { x: 1 })).toEqual(['x']); expect(changedKeys(1, 1)).toEqual([]); expect(changedKeys({ a: 1 }, 5)).toEqual(['(root)'])
  })
})
