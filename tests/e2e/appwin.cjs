module.exports = async ({ tabs, win, sleep, shellEval, shellWins, openAppWindow, settings }) => {
  const http = require('http'), out = {}
  const page = (p) => `<title>Uygulama ${p}</title><body><a id="same" href="/ic">ic</a> <a id="ext" target="_blank" href="http://127.0.0.1:5602/dis">dis</a></body>`
  const s1 = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page(q.url)) })
  const s2 = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<title>Dis</title>x') })
  await new Promise((r) => s1.listen(5601, '127.0.0.1', r)); await new Promise((r) => s2.listen(5602, '127.0.0.1', r))
  const n0 = tabs.list().tabs.filter((t) => !t.app).length
  const ok = await openAppWindow('http://localhost:5601/'); await sleep(3500)
  out.opened = ok
  const app = tabs.list().tabs.find((t) => t.app)
  out.appTab = !!app && app.url.startsWith('http://localhost:5601')
  out.windows = tabs.windowIds().length
  const appWinId = app.winId
  const appShell = shellWins.get(appWinId)
  const ev = (code) => appShell.webContents.executeJavaScript(code).catch((e) => 'ERR ' + e)
  // uygulama penceresi arayuzu: sade cubuk var, sekme seridi/arac cubugu yok
  out.appbar = await ev(`!!document.querySelector('.appbar')`)
  out.noStrip = await ev(`!document.querySelector('.tabstrip') && !document.querySelector('.toolbar')`)
  out.title = await ev(`document.querySelector('.appbar-title')?.textContent`)
  // ana pencere seridinde uygulama sekmesi gorunmez
  out.hiddenInMain = (await shellEval(`[...document.querySelectorAll('.tab')].some(t => t.textContent.includes('Uygulama /'))`)) === false
  // ayni uygulama tekrar acilinca yeni pencere acilmaz
  await openAppWindow('http://localhost:5601/baska'); await sleep(800)
  out.noDuplicate = tabs.windowIds().length === out.windows
  // ayni site ici _blank: ayni pencerede; baska site: ana pencerede sekme
  const wc = tabs.get(app.id).view.webContents
  const nTabs = tabs.list().tabs.length
  await wc.executeJavaScript(`document.getElementById('same').click()`); await sleep(1500)
  out.sameSiteNav = tabs.get(app.id).view.webContents.getURL().endsWith('/ic')
  tabs.get(app.id).view.webContents.loadURL('http://localhost:5601/'); await sleep(1500)
  await tabs.get(app.id).view.webContents.executeJavaScript(`window.open('http://127.0.0.1:5602/dis','_blank'); 1`, true); await sleep(2500)
  const ext = tabs.list().tabs.find((t) => t.url.includes(':5602'))
  out.externalInMain = !!ext && !ext.app && !tabs.isAppWindow(ext.winId)
  out.appStaysPut = tabs.get(app.id).view.webContents.getURL() === 'http://localhost:5601/'
  // uygulama sekmesi kalici oturuma yazilmaz; pencere kapaninca sekme kapanir
  appShell.close(); await sleep(1500)
  out.appClosed = !tabs.list().tabs.some((t) => t.app) && tabs.windowIds().length === out.windows - 1
  out.mainTabsKept = tabs.list().tabs.filter((t) => !t.app).length >= n0
  s1.close(); s2.close(); return out
}
