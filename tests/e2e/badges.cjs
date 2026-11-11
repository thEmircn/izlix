module.exports = async ({ tabs, sleep, shellEval: se, pageEval }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/bad')) { r.writeHead(500); r.end('x'); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>b</title>x') })
  await new Promise((r) => srv.listen(5202, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5202', workspaceId: 'default' }); await sleep(2000)
  const badge = (n) => shellEval(`[...document.querySelectorAll('.rail > button')].find(b=>b.textContent==='${n}')?.getAttribute('data-badge') ?? null`)
  out.before = [await badge('Console'), await badge('Network')]
  await pageEval(`fetch('/bad'); fetch('/bad'); console.error('boom1'); console.error('boom2'); console.error('boom3'); 1`); await sleep(1500)
  out.consoleBadge = await badge('Console'); out.networkBadge = await badge('Network')
  out.labelsClean = await shellEval(`[...document.querySelectorAll('.rail > button')].some(b=>b.textContent==='Console')`)
  srv.close(); return out
}
