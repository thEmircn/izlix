// MVP #7: Responsive Lab - emulasyon, kaydirma/tiklama/yazma senkronu
module.exports = async (ctx) => {
  const { tabs, sleep, click, shot } = ctx
  const http = require('http')
  const html = `<!doctype html><meta name=viewport content="width=device-width,initial-scale=1"><body style="margin:0"><input id=name style="width:90%;height:40px"><button id=b style="height:40px" onclick="document.title='clicked '+(window.__n=(window.__n||0)+1)">go</button><div style="height:4000px;background:linear-gradient(red,blue)">tall</div>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) }); await new Promise((r) => srv.listen(5199, '127.0.0.1', r))
  const out = {}
  const sclick = async (sel) => { const e = tabs.get(tabs.list().activeId); const wc = e.view.webContents; const sc = e.lab.views[0].scale || 1; const [x, y] = await wc.executeJavaScript(`(()=>{const r=document.querySelector(${JSON.stringify(sel)}).getBoundingClientRect();return [r.x+r.width/2,r.y+r.height/2]})()`); const px = Math.round(x * sc), py = Math.round(y * sc); wc.sendInputEvent({ type: 'mouseDown', x: px, y: py, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x: px, y: py, button: 'left', clickCount: 1 }) }
  const id = await tabs.create({ url: 'localhost:5199', workspaceId: 'default' }); await sleep(2000)
  await tabs.setLab(id, ['laptop', 'iphone-se', 'ipad-mini']); await sleep(3500)
  const lab = tabs.get(id).lab
  const ev = (v, code) => v.wc.executeJavaScript(code)
  out.views = await Promise.all(lab.views.map(async (v) => ({ dev: v.device.id, inner: await ev(v, '[innerWidth,innerHeight]'), dpr: await ev(v, 'devicePixelRatio'), ua: await ev(v, 'navigator.userAgent.includes("iPhone")'), touch: await ev(v, "matchMedia('(pointer:coarse)').matches"), bounds: (v.view || tabs.get(id).view).getBounds() })))
  const primary = tabs.get(id).view.webContents
  // kaydirma: birincil gorunumde gercek tekerlek olayi
  const b = tabs.get(id).view.getBounds()
  out.dbg = { bind: await primary.executeJavaScript('[typeof window.__izlix_sync, window.__DB_LAB__, typeof window.__DB_APPLY__]'), attached: primary.debugger.isAttached() }
  const seen = []; primary.debugger.on('message', (_e, m, p) => { if (m === 'Runtime.bindingCalled') seen.push(p.name + ':' + String(p.payload).slice(0, 40)) })
  primary.sendInputEvent({ type: 'mouseWheel', x: 20, y: 200, deltaX: 0, deltaY: -900 }); await sleep(800)
  out.scrollRatios = await Promise.all(lab.views.map(async (v) => +(await ev(v, 'scrollY/Math.max(1,document.documentElement.scrollHeight-innerHeight)')).toFixed(3)))
  out.seen = seen.slice(0, 1)
  out.extra = await Promise.all(lab.views.slice(1).map(async (v) => ({ apply: await ev(v, 'typeof window.__DB_APPLY__'), url: v.wc.getURL() })))
  await primary.executeJavaScript("window.__c=[];addEventListener('mousedown',e=>__c.push([e.clientX,e.clientY,e.isTrusted]),true);addEventListener('click',e=>__c.push(['click',e.target.id]),true)")
  const sc0 = lab.views[0].scale
  out.scale0 = sc0; out.rectB = await primary.executeJavaScript("JSON.stringify(document.querySelector('#b').getBoundingClientRect())")
  primary.sendInputEvent({ type: 'mouseDown', x: 200, y: 100, button: 'left', clickCount: 1 }); primary.sendInputEvent({ type: 'mouseUp', x: 200, y: 100, button: 'left', clickCount: 1 }); await sleep(300)
  out.clicks = await primary.executeJavaScript('JSON.stringify(window.__c)')
  await primary.executeJavaScript('scrollTo(0,0)'); await sleep(500)
  // tiklama: birincilde gercek tiklama -> hepsinde baslik degismeli
  await sclick('#b'); await sleep(600)
  out.titles = await Promise.all(lab.views.map((v) => ev(v, 'document.title')))
  // yazma: input'a tikla + metin ekle
  await sclick('#name'); primary.focus(); await sleep(200); await primary.insertText('merhaba'); await sleep(600)
  out.values = await Promise.all(lab.views.map((v) => ev(v, "document.querySelector('#name').value")))
  await shot(require('os').tmpdir() + '/izlix-e2e-lab.png')
  // cikis: emulasyon geri alinmali
  await tabs.setLab(id, null); await sleep(800)
  out.afterExit = { lab: tabs.get(id).info.lab ?? null, inner: await primary.executeJavaScript('[innerWidth, navigator.userAgent.includes("iPhone")]'), views: tabs.get(id).lab ? 'still' : 'gone' }
  srv.close()
  return out
}
