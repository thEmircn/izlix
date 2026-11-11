module.exports = async ({ tabs, win, sleep, shellEval, pageEval, library }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'set-cookie': 'h=1; Path=/' }); r.end(`<title>Sayfa ${q.url.slice(1)}</title>x`) })
  await new Promise((r) => srv.listen(5391, '127.0.0.1', r))
  for (const p of ['elma', 'armut', 'kiraz']) { await tabs.create({ url: 'http://localhost:5391/' + p, workspaceId: 'default' }); await sleep(1300) }
  win.webContents.send('ui:cmd', 'history.open'); await sleep(900)
  out.dialog = await shellEval(`!!document.querySelector('.dialog.hist')`)
  out.rows = await shellEval(`document.querySelectorAll('.hist-row').length`)
  out.dayHeader = await shellEval(`document.querySelector('.hist-body h4')?.textContent`)
  // arama
  await shellEval(`(()=>{const i=document.querySelector('.hist-head input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'armut');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(600)
  out.searchRows = await shellEval(`[...document.querySelectorAll('.hist-row .hist-t b')].map(b=>b.textContent)`)
  // tek satir silme
  await shellEval(`document.querySelector('.hist-row .hist-x').click()`); await sleep(600)
  out.deleted = !library.visits('armut').length && library.visits('elma').length > 0
  // temizle paneli: cerez + gecmis, tum zamanlar
  await shellEval(`(()=>{const i=document.querySelector('.hist-head input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.hist-head .btn')].find(b=>b.textContent.includes('Clear'))?.click()`); await sleep(400)
  out.clearPanel = await shellEval(`!!document.querySelector('.hist-clear')`)
  const sel = `(()=>{const s=document.querySelector('.hist-clear select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'all');s.dispatchEvent(new Event('change',{bubbles:true}))})()`
  await shellEval(sel); await sleep(200)
  await shellEval(`[...document.querySelectorAll('.hist-clear label input')][1].click()`); await sleep(200)
  await shellEval(`document.querySelector('.hist-clear .btn.primary').click()`); await sleep(1500)
  out.historyEmpty = library.visits().length === 0
  out.emptyShown = await shellEval(`!!document.querySelector('.hist-body .hub-empty')`)
  srv.close(); return out
}
