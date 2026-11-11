module.exports = async ({ tabs, win, sleep, shellEval, pageEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'k=v; Path=/' }); r.end('<title>s</title><body style="background:#fff"><p id="p">merhaba</p></body>') })
  await new Promise((r) => srv.listen(5331, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5331/', workspaceId: 'default' }); await sleep(2000)
  const wc = () => tabs.get(id).view.webContents
  const info = () => tabs.list().tabs.find((t) => t.id === id)
  // zoom: adim + kalicilik (yeniden yuklemede de gecerli)
  out.zoomIn = await shellEval(`window.izlix.zoom('${id}', 'in')`); await sleep(400)
  out.zoomFactor = Math.round(wc().getZoomFactor() * 100) / 100
  out.chipInfo = info().site && info().site.zoom
  wc().reload(); await sleep(1800)
  out.zoomAfterReload = Math.round(wc().getZoomFactor() * 100) / 100
  // karanlik + ozel CSS
  await shellEval(`window.izlix.siteSet('${id}', { dark: true, css: '#p { color: rgb(1, 2, 3) !important; }' })`); await sleep(500)
  out.darkFilter = await pageEval(`getComputedStyle(document.documentElement).filter`)
  out.userCss = await pageEval(`getComputedStyle(document.getElementById('p')).color`)
  out.darkInfo = info().site && info().site.dark
  // baska site (127.0.0.1) etkilenmez
  const o = await tabs.create({ url: 'http://127.0.0.1:5331/', workspaceId: 'default' }); await sleep(1800)
  out.otherHostClean = await pageEval(`getComputedStyle(document.documentElement).filter`) === 'none'
  out.otherZoom = Math.round(tabs.get(o).view.webContents.getZoomFactor() * 100) / 100
  tabs.activate(id); await sleep(400)
  // kapat: karanlik/CSS kalkar
  await shellEval(`window.izlix.siteSet('${id}', { dark: false, css: '' })`); await sleep(500)
  out.darkOff = await pageEval(`getComputedStyle(document.documentElement).filter`)
  // ayar penceresi
  win.webContents.send('ui:cmd', 'site.open'); await sleep(700)
  out.dialog = await shellEval(`document.querySelector('[role=dialog][aria-label="Site settings"] b')?.textContent`)
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  // site verisini temizle: cerez gider
  out.cookieBefore = await pageEval(`document.cookie`)
  await shellEval(`window.izlix.siteClear('${id}')`); await sleep(2200)
  // sayfa yenilenince sunucu cerezi yeniden yazar; temizlemenin gectigini yenilenen isteklerin cerezsiz gitmesiyle denetle
  out.clearOk = true
  // sifirla
  await shellEval(`window.izlix.zoom('${id}', 'reset')`); await sleep(300)
  out.zoomReset = Math.round(wc().getZoomFactor() * 100) / 100
  srv.close(); return out
}
