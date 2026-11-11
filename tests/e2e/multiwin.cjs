module.exports = async ({ tabs, sleep, shellEval, openWindow, shellWins }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(`<title>p${q.url}</title>x`) })
  await new Promise((r) => srv.listen(5281, '127.0.0.1', r))
  const P = tabs.currentWinId
  const A = await tabs.create({ url: 'http://localhost:5281/a', workspaceId: 'default' }); await sleep(1500)
  const w2 = await openWindow(); await sleep(1500)
  out.twoWindows = tabs.windowIds().length === 2 && w2 !== P
  const ev2 = (code) => shellWins.get(w2).webContents.executeJavaScript(code).catch((e) => 'ERR ' + e)
  const B = await tabs.create({ url: 'http://localhost:5281/b', workspaceId: 'default', winId: w2 }); await sleep(2000)
  out.bInWin2 = tabs.get(B).winId === w2 && tabs.list(w2).activeId === B
  out.primaryActiveUnchanged = tabs.list(P).activeId === A
  // seritler: her pencere tum sekmeleri gosterir, digerininkiler 'away'
  const nAll = tabs.list(P).tabs.filter((t) => t.workspaceId === 'default').length
  out.win2Strip = await ev2(`document.querySelectorAll('.tabstrip .tab').length`) === nAll
  out.win2Away = await ev2(`document.querySelectorAll('.tabstrip .tab.away').length`)
  out.primaryAway = await shellEval(`document.querySelectorAll('.tabstrip .tab.away').length`)
  // baska penceredeki sekmeyi aktiflestirmek bu pencerenin aktifini degistirmez
  tabs.activate(B); await sleep(300)
  out.activateOtherKeeps = tabs.list(P).activeId === A
  // A'yi diger pencereye gonder (birincil kabuktan)
  out.hopA = await shellEval(`window.izlix.hopTab('${A}')`); await sleep(800)
  out.aMoved = tabs.get(A).winId === w2 && tabs.list(w2).activeId === A
  out.aVisible = tabs.get(A).view.getBounds().width > 100
  out.primaryNext = tabs.list(P).activeId !== A
  // geri getir (birincil kabuktan, baska penceredeki sekme): buraya gelir
  out.bringBack = await shellEval(`window.izlix.hopTab('${A}')`); await sleep(800)
  out.aBack = tabs.get(A).winId === P && tabs.list(P).activeId === A
  // sekme kapatinca komsu yalnizca ayni pencereden secilir
  const C = await tabs.create({ url: 'http://localhost:5281/c', workspaceId: 'default', winId: w2 }); await sleep(1500)
  tabs.close(C); await sleep(500)
  out.closeNeighborSameWin = tabs.list(w2).activeId === B
  // ikinci pencereyi kapat: sekmeler birincile tasinir
  shellWins.get(w2).close(); await sleep(1200)
  out.oneWindow = tabs.windowIds().length === 1
  out.allBack = tabs.list(P).tabs.every((t) => t.winId === P)
  out.bStillThere = !!tabs.get(B)
  srv.close(); return out
}
