module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>t</title>x') })
  await new Promise((r) => srv.listen(5481, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5481/', workspaceId: 'default' }); await sleep(1800)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network')?.click()`); await sleep(800)
  out.selectShown = await shellEval(`!!document.querySelector('.net-throttle')`)
  const set = (v) => shellEval(`(()=>{const s=document.querySelector('.net-throttle');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${v}');s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  await set('fast-3g'); await sleep(700)
  out.applied = tabs.list().tabs.find((t) => t.id === id).emu?.network
  out.selectValue = await shellEval(`document.querySelector('.net-throttle').value`)
  await set(''); await sleep(700)
  out.cleared = tabs.list().tabs.find((t) => t.id === id).emu?.network
  srv.close(); return out
}
