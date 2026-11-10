module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const js = 'function used(){return 1}\nfunction unusedA(){var x=0;for(var i=0;i<100;i++){x+=i}return x}\nfunction unusedB(){return "never called"+Math.random()}\nused();'
  const html = '<!doctype html><title>c</title><style>.used{color:red}.never-used{color:blue}.also-unused .deep{margin:0}</style><div class="used">hi</div><script src="/app.js"></script>'
  const srv = http.createServer((q, r) => { if (q.url === '/app.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); r.end(js); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5188, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5188', workspaceId: 'default' }); await sleep(2000)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Coverage').click()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.cov .btn')].find(b=>b.textContent==='Reload & record').click()`); await sleep(2500)
  out.recording = await shellEval(`document.querySelector('.cov .net-bar')?.innerText.includes('Recording')`)
  await shellEval(`[...document.querySelectorAll('.cov .btn')].find(b=>b.textContent==='Stop & analyze').click()`); await sleep(2500)
  out.rows = await shellEval(`[...document.querySelectorAll('.covrow')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  out.stats = await shellEval(`[...document.querySelectorAll('.cov .stat')].map(s=>s.innerText.replace(/\\s+/g,' '))`)
  out.selectors = await shellEval(`[...document.querySelectorAll('.selist code')].map(c=>c.textContent)`)
  srv.close()
  return out
}
