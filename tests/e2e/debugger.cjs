module.exports = async ({ tabs, sleep, shellEval: se, pageEval, click, win }) => {
  const http = require('http'), out = { errs: [] }
  const shellEval = (c) => se(c).catch((e) => { out.errs.push(c.slice(0, 90)); return null })
  const js = `function compute(a) {\n  var b = a * 2;\n  var c = b + 1;\n  return c;\n}\ndocument.getElementById('go').onclick = function () { window.result = compute(20); };\n`
  const srv = http.createServer((q, r) => {
    if (q.url === '/app.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); r.end(js); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>dbg</title><button id="go" style="width:100px;height:40px">go</button><script src="/app.js"></script>')
  })
  await new Promise((r) => srv.listen(5183, '127.0.0.1', r))
  const id = await tabs.create({ url: 'localhost:5183', workspaceId: 'default' }); await sleep(2500)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Sources'); await sleep(1200)
  await shellEval(`[...document.querySelectorAll('.srclist > div > .srcitem')].find(e=>e.textContent.startsWith('app.js')).click()`); await sleep(1200)
  out.codeShown = await shellEval(`document.querySelector('.codebody')?.innerText.includes('compute')`)
  // satir 3'e kesme noktasi
  await shellEval(`[...document.querySelectorAll('.cl .ln')].find(e=>e.textContent==='3').click()`); await sleep(700)
  out.bpMarked = await shellEval(`!!document.querySelector('.ln.bp')`)
  await click('#go'); await sleep(1500)
  out.paused = await shellEval(`document.querySelector('.pausedbadge')?.textContent`)
  out.pausedLine = await shellEval(`document.querySelector('.cl.pausedline .ln')?.textContent`)
  out.scope = await shellEval(`[...document.querySelectorAll('.vr')].map(v=>v.innerText.replace(/\\s+/g,' '))`)
  // cagri yigini
  await shellEval(`[...document.querySelectorAll('.dbgpanel .seg2 button')].find(b=>b.textContent.startsWith('Call stack')).click()`); await sleep(300)
  out.frames = await shellEval(`[...document.querySelectorAll('.frame b')].map(b=>b.textContent)`)
  // degerlendir
  await shellEval(`[...document.querySelectorAll('.dbgpanel .seg2 button')].find(b=>b.textContent==='Evaluate').click()`); await sleep(300)
  await shellEval(`(()=>{const i=document.querySelector('.dbgpanel input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'b + 100');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(700)
  out.evalResult = await shellEval(`document.querySelector('.dbgpanel .repl-out')?.textContent`)
  // adimla
  await shellEval(`[...document.querySelectorAll('.dbgbar .btn')].find(b=>b.textContent==='Step over').click()`); await sleep(800)
  out.afterStep = await shellEval(`document.querySelector('.cl.pausedline .ln')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.dbgbar .btn')].find(b=>b.textContent==='Resume').click()`); await sleep(900)
  out.resumed = await shellEval(`!document.querySelector('.pausedbadge')`)
  out.result = await pageEval(`window.result`)
  // kesme noktasini kaldir: tekrar tiklayinca durmamali
  await shellEval(`[...document.querySelectorAll('.cl .ln')].find(e=>e.textContent==='3').click()`); await sleep(500)
  await click('#go'); await sleep(900)
  out.noMorePause = await shellEval(`!document.querySelector('.pausedbadge')`)
  srv.close()
  return out
}
