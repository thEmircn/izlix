module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch((e) => 'ERR ' + e)
  const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64')
  const mk = (port, icon) => new Promise((r) => { const s = http.createServer((q, res) => {
    if (q.url === '/ic.png') { res.writeHead(200, { 'content-type': 'image/png' }); res.end(PNG); return }
    res.writeHead(200, { 'content-type': 'text/html' }); res.end(`<title>t${port}</title><link rel="icon" href="${icon}"><body style="background:#246;color:#fff"><h1>site ${port}</h1></body>`) }); s.listen(port, '127.0.0.1', () => r(s)) })
  const a = await mk(5221, '/ic.png'), b = await mk(5222, '/ic.png'), c = await mk(5223, '/ic.png')
  // A: ziyaret edilir -> sekme ikonu yakalanir
  await tabs.create({ url: 'http://localhost:5221/', workspaceId: 'default' }); await sleep(3500)
  // gizli sekme: ikon kaydedilmemeli
  await tabs.create({ url: 'http://localhost:5223/', workspaceId: 'default', private: 'incognito' }); await sleep(2500)
  const favs = await shellEval(`window.izlix.favicons([]).then(f => Object.keys(f))`)
  out.visitedIcon = Array.isArray(favs) && favs.includes('http://localhost:5221')
  out.privateNoIcon = Array.isArray(favs) && !favs.includes('http://localhost:5223')
  // B: hic acilmadi -> istek uzerine loopback'ten bulunur
  const onDemand = await shellEval(`window.izlix.favicons(['http://localhost:5222']).then(f => (f['http://localhost:5222']||'').slice(0, 22))`)
  out.onDemandIcon = onDemand
  // on izleme: ziyaret edilen A ve istek uzerine B
  const ta = await shellEval(`window.izlix.thumb('http://localhost:5221/').then(d => (d||'').slice(0, 23))`)
  const tb = await shellEval(`window.izlix.thumb('http://localhost:5222/').then(d => (d||'').slice(0, 23))`)
  out.thumbVisited = ta; out.thumbOnDemand = tb
  // disariya istek yok: loopback olmayan adres icin yakalama denenmez
  out.thumbExternal = await shellEval(`window.izlix.thumb('https://example.com/').then(d => d)`)
  a.close(); b.close(); c.close(); return out
}
