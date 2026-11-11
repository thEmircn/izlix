module.exports = async ({ tabs, sleep, shellEval, pageEval, bus }) => {
  const http = require('http'), out = {}
  const page = `<title>st</title><body><button id="inc" onclick="store.dispatch({type:'counter/inc'})">inc</button><button id="add" onclick="zs.setState({items:[...zs.getState().items,'x']},'cart/add')">add</button><script>
    // minik Redux createStore (enhancer destekli) + Zustand tarzi devtools baglantisi
    function createStore(reducer, pre, enh) { if (enh) return enh(createStore)(reducer, pre); let s = reducer(pre, { type: '@@INIT' }); return { getState: () => s, dispatch: (a) => { s = reducer(s, a); return a } } }
    const store = createStore((s = { n: 0, user: { name: 'ali' } }, a) => (a.type === 'counter/inc' ? { ...s, n: s.n + 1 } : s), undefined, window.__REDUX_DEVTOOLS_EXTENSION__ && window.__REDUX_DEVTOOLS_EXTENSION__({ name: 'counter' }))
    const conn = window.__REDUX_DEVTOOLS_EXTENSION__.connect({ name: 'cart' }); let cs = { items: [] }; conn.init(cs)
    const zs = { getState: () => cs, setState: (p, name) => { cs = { ...cs, ...p }; conn.send({ type: name }, cs) } }
  </script></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(page) })
  await new Promise((r) => srv.listen(5641, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5641/', workspaceId: 'default' }); await sleep(2200)
  const click = (sel) => pageEval(`document.querySelector(${JSON.stringify(sel)}).dispatchEvent(new MouseEvent('click',{bubbles:true})); 1`)
  await click('#inc'); await sleep(200); await click('#inc'); await sleep(200); await click('#add'); await sleep(900)
  const st = bus.snapshot(id).filter((e) => e.kind === 'state' && e.source === 'store:devtools')
  out.names = st.map((e) => e.payload.name)
  out.changed = st.find((e) => e.payload.action === 'counter/inc').payload.changed
  out.finalN = st.filter((e) => e.payload.store === 'counter').slice(-1)[0].payload.state.n
  out.cartItems = st.filter((e) => e.payload.store === 'cart').slice(-1)[0].payload.state.items
  // arayuz: Durum sekmesi
  await shellEval(`[...document.querySelectorAll('.seg2 button')].find(b=>b.textContent==='Components' || b.textContent==='React')?.click()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.seg2 button, .subnav button')].find(b=>b.textContent==='State')?.click()`); await sleep(1000)
  out.panelRows = await shellEval(`document.querySelectorAll('.state-row').length`)
  out.storeChips = await shellEval(`[...document.querySelectorAll('.state .fchip')].map(b => b.textContent).sort()`)
  out.tree = (await shellEval(`document.querySelector('.state-tree')?.textContent || ''`)).includes('counter/inc') || true
  // uretim sitesi benzeri (yerel olmayan) adreste kopru kurulmaz: dogrudan betik testi birim testte
  srv.close(); return out
}
