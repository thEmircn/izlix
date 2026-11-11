module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>f</title><body style="background:#2a6;font:30px sans-serif"><h1>DONMUS GORUNTU</h1></body>') })
  await new Promise((r) => srv.listen(5361, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5361/', workspaceId: 'default' }); await sleep(2200)
  const vis = () => tabs.get(id).view.getVisible()
  out.visibleAtStart = vis()
  // modal acilinca: sayfa gizlenir ama kabukte donmus goruntu gorunur
  win.webContents.send('ui:cmd', 'settings.open'); await sleep(900)
  out.hiddenOnOverlay = !vis()
  out.freezeImg = await shellEval(`(document.querySelector('.freeze img')?.src || '').slice(0, 22)`)
  out.freezeSized = await shellEval(`(()=>{const f=document.querySelector('.freeze'); return !!f && f.getBoundingClientRect().width > 200})()`)
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(700)
  out.visibleAfter = vis()
  out.freezeGone = await shellEval(`!document.querySelector('.freeze')`)
  // panel ayiricisini surukleme: baslayinca donmus goruntu, birakinca geri
  await shellEval(`(()=>{const r=document.querySelector('.resizer-v'); if(!r) return; const b=r.getBoundingClientRect(); r.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:b.x+2,clientY:b.y+50,pointerId:1,button:0}))})()`); await sleep(900)
  out.dragFreeze = await shellEval(`!!document.querySelector('.freeze img')`)
  out.dragHidden = !vis()
  await shellEval(`window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}))`); await sleep(700)
  out.dragEndVisible = vis()
  out.dragEndFreezeGone = await shellEval(`!document.querySelector('.freeze')`)
  srv.close(); return out
}
