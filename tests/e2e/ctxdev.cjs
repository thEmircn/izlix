// Sag tik menusu: bu uygulamaya ozgu maddeler (React bileseni editorde ac, secici kopyala, split, lab, proje klasoru ...)
module.exports = async ({ tabs, sleep, shellEval, pageEval, ctxPrepare, editorOpens, lastShot, resetCtx }) => {
  const { clipboard } = require('electron'), fs = require('fs'), out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3800)
  const [x, y] = await pageEval(`(()=>{const r=document.getElementById('load').getBoundingClientRect(); return [Math.round(r.x+r.width/2), Math.round(r.y+r.height/2)]})()`)
  resetCtx()
  const prep = await ctxPrepare(id, { x, y })
  const items = prep.items
  out.firstIsComponent = items[0].act === 'component'
  out.componentName = items[0].arg
  const dev = items.find((i) => i.label === 'cm.dev')
  out.devActs = dev ? dev.submenu.map((i) => i.act || '-') : []
  out.hasNewTab = items.some((i) => i.act === 'newTab')
  // bileseni editorde ac
  await prep.run(items[0]); await sleep(300)
  out.opened = editorOpens()
  // proje klasoru
  resetCtx(); await prep.run(dev.submenu.find((i) => i.act === 'openRoot')); out.rootOpened = editorOpens() && editorOpens().file
  // secici kopyala
  clipboard.writeText(''); await prep.run(dev.submenu.find((i) => i.act === 'copySel')); out.selector = await clipboard.readText()
  // yeni sekme
  const n0 = tabs.list().tabs.length; await prep.run(items.find((i) => i.act === 'newTab')); await sleep(600)
  out.newTabAdded = tabs.list().tabs.length === n0 + 1
  tabs.activate(id); await sleep(500)
  // bolunmus gorunumde ac
  await prep.run({ act: 'linkSplit', arg: 'http://localhost:5173/?split=1' }); await sleep(2500)
  out.split = tabs.list().tabs.filter((t) => t.split).length
  await shellEval(`window.izlix.splitTab(null)`); await sleep(400)
  // Responsive Lab
  await prep.run(dev.submenu.find((i) => i.act === 'lab')); await sleep(2500)
  out.lab = (tabs.list().tabs.find((t) => t.id === id).lab || []).length
  await shellEval(`window.izlix.setLab && window.izlix.setLab('${id}', null)`); await sleep(800)
  // Elements panelinde incele
  await prep.run(dev.submenu.find((i) => i.act === 'inspectEl')); await sleep(1500)
  out.panel = await shellEval(`document.querySelector('.seg2 button.on')?.textContent`)
  // ekran goruntusu
  await prep.run(dev.submenu.find((i) => i.act === 'shotView')); await sleep(800)
  const f = lastShot(); out.shot = !!f && fs.existsSync(f) && fs.statSync(f).size > 1000
  // React olmayan sayfa: bilesen maddesi yok
  const http = require('http'); const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>d</title><button id="b">x</button>') })
  await new Promise((r) => srv.listen(5501, '127.0.0.1', r))
  const id2 = await tabs.create({ url: 'http://localhost:5501/', workspaceId: 'default' }); await sleep(1800)
  const p2 = await ctxPrepare(id2, { x: 30, y: 20 })
  out.noComponentOnPlain = !p2.items.some((i) => i.act === 'component')
  srv.close(); return out
}
