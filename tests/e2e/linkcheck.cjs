module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==', 'base64')
  const srv = http.createServer((q, r) => {
    if (q.url === '/ok') { r.writeHead(200); r.end('ok'); return }
    if (q.url === '/img.png') { r.writeHead(200, { 'content-type': 'image/png' }); r.end(png); return }
    if (q.url === '/') { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>l</title><a href="/ok">ok</a> <a href="/missing">m</a> <a href="/gone">g</a> <a href="https://other.example/">x</a><div style="height:3000px"></div><img src="/img.png" style="width:1px;height:1px"><img src="/nope.png" width=10 height=10 loading=lazy>'); return }
    r.writeHead(404); r.end('nf')
  })
  await new Promise((r) => srv.listen(5185, '127.0.0.1', r))
  const id = await tabs.create({ url: 'localhost:5185', workspaceId: 'default' }); await sleep(2000)
  const lc = await shellEval(`window.izlix.linkCheck(${JSON.stringify(id)})`)
  out.checked = lc.checked; out.statuses = lc.results.map((r) => r.status).sort()
  const im = await shellEval(`window.izlix.imageAudit(${JSON.stringify(id)})`)
  out.imgs = im.length
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Meta').click()`); await sleep(800)
  await shellEval(`[...document.querySelectorAll('.seo .btn')].find(b=>b.textContent==='Check links').click()`); await sleep(2500)
  out.linkSummary = await shellEval(`document.querySelector('.toolres b')?.textContent`)
  out.brokenRows = await shellEval(`document.querySelectorAll('.toolres .seoi.error').length`)
  await shellEval(`[...document.querySelectorAll('.seo .btn')].find(b=>b.textContent==='Audit images').click()`); await sleep(1200)
  out.imgSummary = await shellEval(`[...document.querySelectorAll('.toolres b')].pop()?.textContent`)
  srv.close()
  return out
}
