module.exports = async ({ tabs, sleep, shellEval: se, pageEval, click }) => {
  const http = require('http'), out = { errs: [] }
  const shellEval = (c) => Promise.race([se(c).catch((e) => { out.errs.push(c.slice(0, 90)); return null }), new Promise((r) => setTimeout(() => r('TIMEOUT'), 8000))])
  const js = `function helper() {\n  var secretNeedle = 42;\n  return secretNeedle;\n}\ndocument.getElementById('go').addEventListener('click', function () { helper(); fetch('/api/data'); });\n`
  const srv = http.createServer((q, r) => {
    if (q.url === '/app.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); r.end(js); return }
    if (q.url.startsWith('/api/')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{}'); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>s2</title><button id="go" style="width:100px;height:40px">go</button><script src="/app.js"></script>')
  })
  await new Promise((r) => srv.listen(5194, '127.0.0.1', r))
  const tid = await tabs.create({ url: 'localhost:5194', workspaceId: 'default' }); await sleep(2500)
  const rail = (n) => shellEval(`[...document.querySelectorAll('.rail > button')].find(b=>b.textContent==='${n}')?.click()`)
  const side = (n) => shellEval(`[...document.querySelectorAll('.srcside .seg2 button')].find(b=>b.textContent.startsWith('${n}'))?.click()`)
  const trigger = () => Promise.race([pageEval(`setTimeout(()=>document.getElementById('go').click(), 30); 1`), new Promise((r) => setTimeout(() => r('PAGE-HUNG'), 5000))])
  await rail('Sources'); await sleep(1200)
  // 1) tum dosyalarda arama
  await side('Search'); await sleep(300)
  await shellEval(`(()=>{const i=document.querySelector('.srcside input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'secretNeedle');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(1800)
  out.hitCount = await shellEval(`document.querySelectorAll('.srchit').length`)
  out.hitText = await shellEval(`document.querySelector('.srchit span')?.textContent`)
  await shellEval(`document.querySelector('.srchit').click()`); await sleep(1000)
  out.opened = await shellEval(`document.querySelector('.codebody')?.innerText.includes('secretNeedle')`)
  // 2) olay dinleyici kesme noktasi
  await side('Breakpoints'); await sleep(300)
  await shellEval(`[...document.querySelectorAll('.evgroup .fchip')].find(b=>b.textContent==='click').click()`); await sleep(600)
  out.evChipOn = await shellEval(`[...document.querySelectorAll('.evgroup .fchip.on')].map(b=>b.textContent)`)
  await trigger(); await sleep(1500)
  out.evPaused = await shellEval(`document.querySelector('.pausedbadge')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.dbgbar .btn')].find(b=>b.textContent==='Resume').click()`); await sleep(900)
  out.afterResume1 = await shellEval(`!document.querySelector('.pausedbadge')`)
  await shellEval(`[...document.querySelectorAll('.evgroup .fchip')].find(b=>b.textContent==='click').click()`); await sleep(500)
  // 3) XHR kesme noktasi
  await shellEval(`(()=>{const i=document.querySelector('.xhr-add input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'/api/data');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(600)
  out.xhrRows = await shellEval(`[...document.querySelectorAll('.bprow span')].map(s=>s.textContent)`)
  await trigger(); await sleep(1500)
  out.xhrPaused = await shellEval(`document.querySelector('.pausedbadge')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.dbgbar .btn')].find(b=>b.textContent==='Resume').click()`); await sleep(900)
  out.resumed = await shellEval(`!document.querySelector('.pausedbadge')`)
  srv.close(); return out
}
