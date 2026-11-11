module.exports = async ({ tabs, win, sleep, shellEval, pageEval, ctxPrepare, notes }) => {
  const http = require('http'), out = {}
  const html = '<title>not</title><body style="font:20px sans-serif;padding:30px"><p id="p1">Birinci cumle burada yer alir ve guzeldir.</p><p id="p2">Merhaba <b>kalin yazi</b> dunya nasilsin?</p></body>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html) })
  await new Promise((r) => srv.listen(5591, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5591/', workspaceId: 'default' }); await sleep(1800)
  const select = (code) => pageEval(`(()=>{ ${code} })()`)
  // 1) tek dugumde secim -> vurgula
  await select(`const t=document.getElementById('p1').firstChild; const r=document.createRange(); r.setStart(t, 8); r.setEnd(t, 14); const s=getSelection(); s.removeAllRanges(); s.addRange(r)`)
  let p = await ctxPrepare(id, { x: 60, y: 60, selectionText: 'cumle' })
  out.menuHas = p.items.filter((i) => ['highlight', 'addNote'].includes(i.act)).map((i) => i.act)
  await p.run(p.items.find((i) => i.act === 'highlight')); await sleep(800)
  out.marks1 = await pageEval(`[...document.querySelectorAll('mark[data-db-note]')].map(m => m.textContent)`)
  out.stored = notes().all().length
  // 2) birden cok dugume yayilan secim (<b> icerir) -> ayni vurgu parcalari
  await select(`const p=document.getElementById('p2'); const r=document.createRange(); r.setStart(p.firstChild, 3); r.setEnd(p.lastChild, 5); const s=getSelection(); s.removeAllRanges(); s.addRange(r)`)
  p = await ctxPrepare(id, { x: 60, y: 110, selectionText: 'x' })
  await p.run(p.items.find((i) => i.act === 'highlight')); await sleep(800)
  out.crossMarks = await pageEval(`[...document.querySelectorAll('p#p2 mark')].map(m => m.textContent).join('')`)
  // 3) yeniden yukle: vurgular geri gelir
  tabs.reload(id); await sleep(3500)
  out.afterReload = await pageEval(`document.querySelectorAll('mark[data-db-note]').length`)
  // 4) not ekle (renderer istemi) -> not metni tooltip olur
  await select(`const t=document.getElementById('p1').lastChild||document.getElementById('p1'); const el=document.getElementById('p1'); const w=document.createTreeWalker(el, NodeFilter.SHOW_TEXT); let last; while(w.nextNode()) last=w.currentNode; const r=document.createRange(); r.setStart(last, Math.max(0,last.textContent.length-8)); r.setEnd(last, last.textContent.length-1); const s=getSelection(); s.removeAllRanges(); s.addRange(r)`)
  p = await ctxPrepare(id, { x: 60, y: 60, selectionText: 'x' })
  await p.run(p.items.find((i) => i.act === 'addNote')); await sleep(900)
  out.promptShown = await shellEval(`!!document.querySelector('[role=dialog][aria-label="Add a note"] textarea')`)
  await shellEval(`(()=>{const t=document.querySelector('[role=dialog][aria-label="Add a note"] textarea'); Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'Onemli not'); t.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(200)
  await shellEval(`document.querySelector('[role=dialog][aria-label="Add a note"] .btn.primary').click()`); await sleep(1200)
  out.tooltip = await pageEval(`[...document.querySelectorAll('mark[data-db-note]')].map(m => m.title).filter(Boolean)`)
  // 5) vurgunun uzerinde sag tik: duzenle/kaldir; kaldir
  const [mx, my] = await pageEval(`(()=>{const m=document.querySelector('mark[data-db-note]'); const r=m.getBoundingClientRect(); return [Math.round(r.x+r.width/2), Math.round(r.y+r.height/2)]})()`)
  p = await ctxPrepare(id, { x: mx, y: my })
  out.onMarkItems = p.items.slice(0, 2).map((i) => i.act)
  const before = notes().all().length
  await p.run(p.items.find((i) => i.act === 'removeNote')); await sleep(700)
  out.removed = notes().all().length === before - 1
  // 6) notlar sayfasi
  win.webContents.send('ui:cmd', 'notes.open'); await sleep(900)
  out.rows = await shellEval(`document.querySelectorAll('.note-row').length`)
  out.rowsMatch = out.rows === notes().all().length
  srv.close(); return out
}
