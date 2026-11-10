module.exports = async ({ tabs, sleep, shellEval, win }) => {
  const http = require('http'), out = {}
  const html = '<!doctype html><title>o</title><script>setTimeout(()=>{fetch("/api/a");fetch("/api/bad");console.error("boom")},300)</script>'
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/api/bad')) { r.writeHead(500); r.end('x'); return } if (q.url.startsWith('/api')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{}'); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5191, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5191', workspaceId: 'default' }); await sleep(2500)
  await shellEval(`[...document.querySelectorAll('.rail > button')].find(b=>b.textContent==='Overview').click()`); await sleep(800)
  out.tiles = await shellEval(`[...document.querySelectorAll('.ov .tile')].length`)
  out.pill = await shellEval(`document.querySelector('.ov .pill')?.textContent.trim()`)
  out.requests = await shellEval(`document.querySelector('.ov .tile .big')?.textContent`)
  out.activity = await shellEval(`document.querySelectorAll('.ov .act').length`)
  await shellEval(`document.querySelector('.ov .act').click()`); await sleep(500)
  out.jumped = await shellEval(`document.querySelector('.rail > button.on')?.textContent`)
  out.railCount = await shellEval(`document.querySelectorAll('.rail > button[role=tab]').length`)
  srv.close(); return out
}
