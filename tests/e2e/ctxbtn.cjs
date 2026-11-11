// Sag tik: <a> olmayan dugmelerin hedef sayfasini yeni sekmede/pencerede ac (tiklamayi yonlendirme)
module.exports = async ({ tabs, sleep, ctxPrepare }) => {
  const http = require('http'), out = {}
  const page = `<title>ana</title><body style="margin:0">
  <button id="go" style="position:absolute;left:20px;top:20px;width:120px;height:40px">Git</button>
  <button id="oc" style="position:absolute;left:200px;top:20px;width:120px;height:40px" onclick="location.href='/hedef-onclick'">Onclick</button>
  <script>document.getElementById('go').addEventListener('click', () => { location.href = '/hed' + 'ef' })</script>
  <button id="spa" style="position:absolute;left:20px;top:80px;width:120px;height:40px" onclick="history.pushState({},'','/spa-yolu')">SPA</button>
  <button id="df" data-href="/veri-href" style="position:absolute;left:20px;top:140px;width:120px;height:40px">Veri</button>
  <a id="lnk" href="/baglanti" style="position:absolute;left:20px;top:200px">Baglanti</a>
  <p id="txt" style="position:absolute;left:20px;top:260px">duz metin</p></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(q.url === '/' ? page : `<title>${q.url}</title>x`) })
  await new Promise((r) => srv.listen(5511, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5511/', workspaceId: 'default' }); await sleep(2000)
  const wc = tabs.get(id).view.webContents
  const items = async (x, y, extra = {}) => (await ctxPrepare(id, { x, y, ...extra }))
  // 0) onclick='location.href=...' metninden adres okunur: dogrudan baglanti maddeleri
  let p = await items(240, 40)
  out.onclickHrefItems = p.items.slice(0, 2).map((i) => i.act); out.onclickHrefArg = p.items[0].arg
  // 1) addEventListener ile gezinen dugme: adres bilinmiyor -> "tiklamayi yonlendir" maddeleri
  p = await items(60, 40)
  out.btnItems = p.items.slice(0, 2).map((i) => i.act)
  const n0 = tabs.list().tabs.length
  await p.run(p.items.find((i) => i.act === 'btnNewTab')); await sleep(4500)
  out.newTabUrl = tabs.list().tabs.slice(-1)[0].url
  out.newTabAdded = tabs.list().tabs.length === n0 + 1
  out.originalStays = wc.getURL() === 'http://localhost:5511/'
  // 2) pushState (SPA) duğmesi: yeni sekmeye gider, bu sekme geri sarilir
  tabs.activate(id); await sleep(400)
  p = await items(60, 100)
  await p.run(p.items.find((i) => i.act === 'btnNewTab')); await sleep(2500)
  out.spaNewTab = tabs.list().tabs.some((t) => t.url === 'http://localhost:5511/spa-yolu')
  out.spaRewound = wc.getURL() === 'http://localhost:5511/'
  // 3) data-href: adres bilindigi icin dogrudan baglanti maddeleri (tiklama yok)
  tabs.activate(id); await sleep(400)
  p = await items(60, 160)
  out.dataHrefItems = p.items.slice(0, 2).map((i) => i.act)
  out.dataHrefArg = p.items[0].arg
  // 4) yeni pencerede ac: ikinci pencere acilir, sekme orada
  await p.run(p.items.find((i) => i.act === 'linkNewWindow')); await sleep(6000)
  out.twoWindows = tabs.windowIds().length === 2
  const t = tabs.list().tabs.find((x) => x.url === 'http://localhost:5511/veri-href')
  out.inOtherWindow = !!t && t.winId !== tabs.list().tabs.find((x) => x.id === id).winId
  // 5) duz metin ve gercek baglanti: dugme maddesi yok
  p = await items(30, 270)
  out.plainText = !p.items.some((i) => i.act === 'btnNewTab')
  p = await items(40, 205, { linkURL: 'http://localhost:5511/baglanti' })
  out.linkHasNewWindow = p.items.some((i) => i.act === 'linkNewWindow') && !p.items.some((i) => i.act === 'btnNewTab')
  srv.close(); return out
}
