// Tahmini bag (yanit -> render) dogrulugu: ayni tiklamadan iki es zamanli istek, farkli gecikmeler
module.exports = async (ctx) => { try { return await main(ctx) } catch (e) { return { fail: String(e && e.stack || e).slice(0, 500) } } }
async function main({ tabs, sleep, bus, pageEval }) {
  const http = require('http'), fs = require('fs'), path = require('path')
  const root = require('os').tmpdir() + '/izlix-e2e-conc/dist'
  const srv = http.createServer((q, r) => {
    const u = new URL(q.url, 'http://x')
    if (u.pathname === '/a' || u.pathname === '/b') { setTimeout(() => r.end(u.pathname.slice(1) + Math.random().toString(36).slice(2, 5)), Number(u.searchParams.get('d') || 0)); return }
    const f = path.join(root, u.pathname === '/' ? 'index.html' : u.pathname)
    try { const body = fs.readFileSync(f); r.writeHead(200, { 'content-type': f.endsWith('.js') ? 'text/javascript' : 'text/html' }); r.end(body) } catch { r.writeHead(404).end() }
  }); await new Promise((r) => srv.listen(5197, '127.0.0.1', r))
  const out = { trials: 0, correct: 0, wrong: 0, missing: 0, details: [] }
  const id = await tabs.create({ url: 'localhost:5197', workspaceId: 'default' }); await sleep(2500)
  out.page = await pageEval('document.body.innerHTML.slice(0,200)').catch((e) => 'ERR ' + e)
  const rnd = (a, b) => a + Math.floor(Math.random() * (b - a))
  for (let i = 0; i < 20; i++) {
    const dA = rnd(40, 300), dB = rnd(40, 300)
    if (Math.abs(dA - dB) < 60) { i--; continue }
    const before = bus.snapshot(id).length
    await pageEval(`window.dA=${dA};window.dB=${dB};document.querySelector('#go').click()`)
    await sleep(900)
    const ev = bus.snapshot(id).slice(before)
    const res = (n) => ev.find((e) => e.kind === 'response' && e.payload.url.includes('/' + n + '?'))
    const renderOf = (name) => ev.find((e) => e.kind === 'render' && (e.payload.components || []).some((c) => c.name === name && c.reason !== 'parent'))
    for (const [n, comp] of [['a', 'PanelA'], ['b', 'PanelB']]) {
      const rd = renderOf('App'), rs = res(n)
      // App state degisince tum App render olur; PanelX props degisimi ayni commit'te. Hangi yanit hangi commit'e bagli?
      const commitForPanel = ev.find((e) => e.kind === 'render' && (e.payload.components || []).some((c) => c.name === comp && c.reason.startsWith('props')))
      out.trials++
      if (!commitForPanel || !rs) { out.missing++; continue }
      const linked = commitForPanel.links.find((l) => l.type === 'response→render')
      if (!linked) { out.missing++; out.details.push({ dA, dB, n, note: 'baglanti yok' }); continue }
      if (linked.from === rs.id) out.correct++; else { out.wrong++; const other = bus.get(linked.from); out.details.push({ dA, dB, n, linkedTo: other && other.payload.url.split('?')[0] }) }
    }
  }
  out.accuracy = +(out.correct / Math.max(1, out.trials)).toFixed(2)
  srv.close()
  return out
}
