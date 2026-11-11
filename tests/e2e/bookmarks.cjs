module.exports = async ({ tabs, win, sleep, shellEval, library }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(`<title>Sayfa ${q.url.slice(1)}</title>x`) })
  await new Promise((r) => srv.listen(5401, '127.0.0.1', r))
  const a = await tabs.create({ url: 'http://localhost:5401/elma', workspaceId: 'default' }); await sleep(1500)
  await shellEval(`window.izlix.toggleBookmark('${a}')`); await sleep(300)
  const b = await tabs.create({ url: 'http://localhost:5401/armut', workspaceId: 'default' }); await sleep(1500)
  await shellEval(`window.izlix.toggleBookmark('${b}')`); await sleep(500)
  const y0 = tabs.get(b).view.getBounds().y
  // yonetici
  win.webContents.send('ui:cmd', 'bm.open'); await sleep(800)
  out.rows = await shellEval(`document.querySelectorAll('.bm-row').length`)
  // klasor olustur + A'yi tasi
  await shellEval(`[...document.querySelectorAll('.bm-side .ghost')][0].click()`); await sleep(200)
  await shellEval(`(()=>{const i=document.querySelector('.bm-side input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Meyve');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(150)
  await shellEval(`document.querySelector('.bm-side input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`); await sleep(400)
  await shellEval(`[...document.querySelectorAll('.bm-side button')].find(b=>b.textContent.startsWith('All')||b.textContent.startsWith('Tüm')).click()`); await sleep(300)
  await shellEval(`(()=>{const row=[...document.querySelectorAll('.bm-row')].find(r=>r.querySelector('.bm-u').value.endsWith('/elma')); const s=row.querySelector('select'); Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'Meyve'); s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(600)
  out.folderSet = library.bookmarks('default').find((x) => x.url.endsWith('/elma')).folder
  out.folders = library.folders('default')
  // baslik duzenle
  await shellEval(`(()=>{const row=[...document.querySelectorAll('.bm-row')].find(r=>r.querySelector('.bm-u').value.endsWith('/armut')); const i=row.querySelector('.bm-t'); i.focus(); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Armut Yeni'); i.dispatchEvent(new Event('input',{bubbles:true})); i.dispatchEvent(new FocusEvent('focusout',{bubbles:true})); i.blur()})()`); await sleep(600)
  out.titleEdited = library.bookmarks('default').find((x) => x.url.endsWith('/armut')).title
  await shellEval(`document.querySelector('.dialog.bm').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(500)
  // cubuk
  win.webContents.send('ui:cmd', 'bmbar.toggle'); await sleep(900)
  out.bar = await shellEval(`!!document.querySelector('.bmbar')`)
  out.chips = await shellEval(`[...document.querySelectorAll('.bmbar .bmchip')].map(c=>c.textContent.trim())`)
  out.pageShifted = tabs.get(tabs.list().activeId).view.getBounds().y - y0
  // kok yer imine tikla -> gezinir
  tabs.activate(a); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.bmbar .bmchip')].find(c=>c.textContent.includes('Armut Yeni')).click()`); await sleep(1500)
  out.navigated = tabs.active().info.url.endsWith('/armut')
  // silme
  win.webContents.send('ui:cmd', 'bm.open'); await sleep(700)
  await shellEval(`[...document.querySelectorAll('.bm-row')].find(r=>r.querySelector('.bm-u').value.endsWith('/armut')).querySelector('.hist-x').click()`); await sleep(600)
  out.removed = library.bookmarks('default').length === 1
  win.webContents.send('ui:cmd', 'bmbar.toggle'); await sleep(400)
  srv.close(); return out
}
