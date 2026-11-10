module.exports = async ({ tabs, sleep, shellEval: se, pageEval }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(`<title>${q.url.slice(1) || 'root'}</title><body style="margin:0"><h1>${q.url}</h1>`) })
  await new Promise((r) => srv.listen(5196, '127.0.0.1', r))
  const a = await tabs.create({ url: 'localhost:5196/a', workspaceId: 'default' }); await sleep(1500)
  const b = await tabs.create({ url: 'localhost:5196/b', workspaceId: 'default' }); await sleep(1500)
  tabs.activate(a); await sleep(400)
  const before = tabs.get(a).view.getBounds()
  out.ok = tabs.setSplit(b); await sleep(500)
  const ba = tabs.get(a).view.getBounds(), bb = tabs.get(b).view.getBounds()
  out.sideBySide = bb.x > ba.x + ba.width - 1 && ba.y === bb.y && ba.height === bb.height
  out.halves = Math.abs(ba.width - bb.width) <= 1 && ba.width < before.width
  out.splitIds = tabs.splitIds.length
  out.tabClasses = await shellEval(`[...document.querySelectorAll('.tab.split')].length`)
  // iki gorunum de gercekten yuklu ve gorunur
  out.titles = [await tabs.get(a).view.webContents.executeJavaScript('document.title'), await tabs.get(b).view.webContents.executeJavaScript('document.title')]
  // odak degisimi: sag sekmeyi aktif yap; gorunumler yerinde kalir
  tabs.activate(b); await sleep(500)
  out.activeAfter = tabs.active().info.id === b
  const ba2 = tabs.get(a).view.getBounds(), bb2 = tabs.get(b).view.getBounds()
  out.stable = ba2.x === ba.x && bb2.x === bb.x
  // partner kapaninca bolme kalkar, kalan gorunum tam genislige doner
  tabs.close(a); await sleep(600)
  out.splitCleared = tabs.splitIds.length === 0
  const bf = tabs.get(b).view.getBounds()
  out.fullAgain = bf.width > bb.width + 50
  srv.close(); return out
}
