// Vue 3 adaptoru: tikla -> fetch -> yanit -> render zinciri (gercek Vue gelistirme derlemesiyle)
module.exports = async ({ tabs, bus, sleep, pageEval, click }) => {
  const http = require('http'), fs = require('fs'), path = require('path'), out = {}
  const root = path.join(process.cwd(), 'tests', 'testapps', 'vue')
  const TYPES = { '.html': 'text/html', '.js': 'text/javascript' }
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x')
    if (u.pathname === '/api/items') return setTimeout(() => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify([{ id: 1, name: 'A' }, { id: 2, name: 'B' }, { id: 3, name: 'C' }])) }, 100)
    const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname)
    if (!f.startsWith(root) || !fs.existsSync(f)) { r.writeHead(404); return r.end() }
    r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream', 'cache-control': 'no-store' }); r.end(fs.readFileSync(f))
  })
  await new Promise((r) => srv.listen(5675, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://127.0.0.1:5675/', workspaceId: 'default' }); await sleep(2500)
  out.rendered = await pageEval(`!!document.querySelector('#load')`)
  await click('#load'); await sleep(1800)
  out.list = await pageEval(`document.querySelectorAll('li').length`)
  const evs = bus.snapshot(id), by = (k) => evs.filter((e) => e.kind === k)
  const input = by('input').find((e) => /load/.test(String(e.payload.target)))
  const req = by('request').find((e) => /api\/items/.test(String(e.payload.url)))
  const res = by('response').find((e) => /api\/items/.test(String(e.payload.url)))
  const vueCommits = by('render').filter((e) => e.payload.renderer === 'vue')
  const names = new Set(vueCommits.flatMap((e) => (e.payload.components || []).map((c) => c.name)))
  out.vueCommits = vueCommits.length
  out.names = [...names].sort().join(',')
  out.inputToRequest = !!(input && req && req.links.some((l) => l.from === input.id && l.certainty === 'exact'))
  out.requestToResponse = !!(req && res && res.links.some((l) => l.from === req.id))
  const last = vueCommits[vueCommits.length - 1]
  out.responseToRender = !!(res && last && last.links.some((l) => l.from === res.id))
  srv.close(); return out
}
