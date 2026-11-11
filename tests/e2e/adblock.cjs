module.exports = async ({ tabs, sleep, settings, pageEval }) => {
  const http = require('http'), out = {}
  const html = '<title>reklamli</title><div class="adsbygoogle" style="height:50px">AD</div><img src="http://ads.doubleclick.net/x.png"><script src="https://pagead2.googlesyndication.com/a.js"></script><script src="https://www.google-analytics.com/analytics.js"></script><p id="own">icerik</p>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5241, '127.0.0.1', r))
  const open = async () => { const id = await tabs.create({ url: 'http://localhost:5241/', workspaceId: 'default' }); await sleep(2500); return tabs.list().tabs.find((t) => t.id === id) }
  // 1) varsayilan: gelistirme sayfasina dokunma
  settings.set({ adblock: 'ads', adblockDev: false, adblockAllow: [] })
  out.devUntouched = (await open()).blocked ?? 0
  // 2) dev'de de engelle (ads): img + googlesyndication = 2 ; analytics gecer
  settings.set({ adblockDev: true })
  const b = await open()
  out.adsBlocked = b.blocked ?? 0
  out.adHidden = await pageEval(`getComputedStyle(document.querySelector('.adsbygoogle')).display`)
  out.contentVisible = await pageEval(`getComputedStyle(document.querySelector('#own')).display`)
  // 3) strict: analytics de engellenir
  settings.set({ adblock: 'strict' })
  out.strictBlocked = (await open()).blocked ?? 0
  // 4) site izni
  settings.set({ adblockAllow: ['localhost'] })
  out.allowedBlocked = (await open()).blocked ?? 0
  // 5) kapali
  settings.set({ adblockAllow: [], adblock: 'off' })
  out.offBlocked = (await open()).blocked ?? 0
  settings.set({ adblock: 'ads', adblockDev: false })
  srv.close(); return out
}
