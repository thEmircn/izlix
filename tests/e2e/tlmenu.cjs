module.exports = async ({ tabs, sleep, shellEval: se, pageEval, rules }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/api/x')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"a":1}'); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>m</title>x') })
  await new Promise((r) => srv.listen(5204, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5204', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`fetch('/api/x'); 1`); await sleep(1500)
  const rightClick = () => shellEval(`(()=>{const c=[...document.querySelectorAll('.tl-svg circle.node')].filter(x=>x.getAttribute('fill')==='#f4f4f5').pop(); if(!c) return false; const r=c.getBoundingClientRect(); c.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.x+4,clientY:r.y+4})); return true})()`)
  out.dispatched = await rightClick(); await sleep(500)
  out.items = await shellEval(`[...document.querySelectorAll('.ctxmenu .ctx-item')].map(b=>b.textContent)`)
  // Ag'da goster
  await shellEval(`[...document.querySelectorAll('.ctxmenu .ctx-item')].find(b=>b.textContent==='Show in Network')?.click()`); await sleep(900)
  out.menuClosed = await shellEval(`!document.querySelector('.ctxmenu')`)
  out.railAfter = await shellEval(`document.querySelector('.rail > button.on')?.textContent`)
  // Timeline'a don, kural yap
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Timeline')?.click()`); await sleep(900)
  const before = rules.get('default').rules.length
  await rightClick(); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.ctxmenu .ctx-item')].find(b=>b.textContent==='Make a 500 rule')?.click()`); await sleep(1500)
  out.ruleAdded = rules.get('default').rules.length === before + 1
  out.lastRuleUrl = rules.get('default').rules.slice(-1)[0]?.match?.url ?? JSON.stringify(rules.get('default').rules.slice(-1)[0]).slice(0, 120)
  srv.close(); return out
}
