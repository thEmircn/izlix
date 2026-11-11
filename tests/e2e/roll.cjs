module.exports = async ({ tabs, sleep, shellEval, pageEval, shot }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/api')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"a":1}'); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>r</title>x') })
  await new Promise((r) => srv.listen(5371, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5371/', workspaceId: 'default' }); await sleep(1800)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network')?.click()`); await sleep(800)
  const label = () => shellEval(`document.querySelector('.net-stats .stat b .roll')?.getAttribute('aria-label')`)
  out.before = Number(await label())
  out.hasStrips = await shellEval(`document.querySelectorAll('.net-stats .roll-d').length`)
  await pageEval(`for (let i=0;i<17;i++) fetch('/api/'+i); 0`); await sleep(120)
  // animasyon sirasinda: seritler hareket halinde (transform sifirdan farkli) ve goruntu al
  out.moving = await shellEval(`[...document.querySelectorAll('.net-stats .roll-strip')].some(s => getComputedStyle(s).transform !== 'none' && getComputedStyle(s).transform !== 'matrix(1, 0, 0, 1, 0, 0)')`)
  await shot('/private/tmp/e2e-tmp/roll-mid.png')
  await sleep(1500)
  out.after = Number(await label())
  out.grew = out.after >= out.before + 17
  // metin: aria-label gercek deger, gorunen rakam kolonlari esit sayida
  out.digitCols = await shellEval(`document.querySelectorAll('.net-stats .stat:first-child .roll-d').length`) === String(out.after).length
  await shot('/private/tmp/e2e-tmp/roll-end.png')
  srv.close(); return out
}
