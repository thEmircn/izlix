module.exports = async ({ tabs, sleep, settings, pageEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url === '/' ? '<title>ana</title><a id="l" href="/t?utm_source=x&id=5&fbclid=abc">link</a>' : '<title>hedef</title>x') })
  await new Promise((r) => srv.listen(5301, '127.0.0.1', r))
  settings.set({ stripTracking: true, stripTrackingDev: false })
  await tabs.create({ url: 'http://localhost:5301/', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`document.getElementById('l').click()`); await sleep(1500)
  out.devUntouched = tabs.active().info.url
  settings.set({ stripTrackingDev: true })
  await tabs.create({ url: 'http://localhost:5301/', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`document.getElementById('l').click()`); await sleep(1500)
  out.cleanedClick = tabs.active().info.url
  tabs.go(tabs.active().info.id, 'localhost:5301/t?gclid=1&k=2'); await sleep(1500)
  out.cleanedTyped = tabs.active().info.url
  settings.set({ stripTracking: false })
  tabs.go(tabs.active().info.id, 'localhost:5301/t?gclid=1&k=2'); await sleep(1500)
  out.offKeeps = tabs.active().info.url
  srv.close(); return out
}
