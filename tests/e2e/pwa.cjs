module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const manifest = JSON.stringify({ name: 'PWA Demo', short_name: 'Demo', start_url: '/', display: 'standalone', theme_color: '#ff6a2b', icons: [{ src: '/i.png', sizes: '192x192' }, { src: '/i2.png', sizes: '512x512', purpose: 'maskable' }] })
  const html = '<!doctype html><html><head><title>pwa</title><link rel="manifest" href="/manifest.json"></head><body>pwa<script>navigator.serviceWorker.register("/sw.js")</script></body></html>'
  const srv = http.createServer((q, r) => {
    if (q.url === '/manifest.json') { r.writeHead(200, { 'content-type': 'application/manifest+json' }); r.end(manifest); return }
    if (q.url === '/sw.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); r.end('self.addEventListener("install",()=>self.skipWaiting());self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()))'); return }
    if (q.url.endsWith('.png')) { r.writeHead(200, { 'content-type': 'image/png' }); r.end(Buffer.alloc(8)); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end(html)
  })
  await new Promise((r) => srv.listen(5199, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5199', workspaceId: 'default' }); await sleep(2500)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Storage')?.click()`); await sleep(1000)
  await shellEval(`[...document.querySelectorAll('.st .seg2 button')].find(b=>b.textContent==='App')?.click()`); await sleep(2000)
  out.manifestName = await shellEval(`[...document.querySelectorAll('.pwa-kv > div')].find(d=>d.textContent.startsWith('name'))?.querySelector('code')?.textContent`)
  out.display = await shellEval(`[...document.querySelectorAll('.pwa-kv > div')].find(d=>d.textContent.startsWith('display'))?.querySelector('code')?.textContent`)
  out.installable = await shellEval(`document.querySelector('.appinfo .pill')?.textContent.trim()`)
  out.checksOk = await shellEval(`document.querySelectorAll('.pwa-chk.ok').length`)
  out.swCards = await shellEval(`document.querySelectorAll('.sw-card').length`)
  out.swStatus = await shellEval(`document.querySelector('.sw-h .pill')?.textContent.trim()`)
  await shellEval(`[...document.querySelectorAll('.sw-card .btn')].find(b=>b.textContent==='Unregister')?.click()`); await sleep(1500)
  out.swAfter = await shellEval(`document.querySelectorAll('.sw-card').length`)
  srv.close(); return out
}
