module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const js = 'function spin(ms){var t=Date.now();while(Date.now()-t<ms){Math.sqrt(Math.random())}}\nfunction heavyWork(){spin(250)}\nfunction lightWork(){spin(30)}\nsetTimeout(function(){heavyWork();lightWork()},100);'
  const html = '<!doctype html><title>p</title><div>profile me</div><script src="/app.js"></script>'
  const srv = http.createServer((q, r) => { if (q.url === '/app.js') { r.writeHead(200, { 'content-type': 'text/javascript' }); r.end(js); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5189, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5189', workspaceId: 'default' }); await sleep(2000)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Profiler').click()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.prof .btn')].find(b=>b.textContent==='Reload & record').click()`); await sleep(2500)
  out.recording = await shellEval(`document.querySelector('.prof .net-bar')?.innerText.includes('Recording')`)
  await shellEval(`[...document.querySelectorAll('.prof .btn')].find(b=>b.textContent==='Stop').click()`); await sleep(2000)
  out.rows = await shellEval(`[...document.querySelectorAll('.profrow')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  out.heavyRow = (out.rows.find((r) => r.startsWith('heavyWork')) || '')
  out.flameBoxes = await shellEval(`document.querySelectorAll('.flame .fl').length`)
  out.flameHasHeavy = await shellEval(`[...document.querySelectorAll('.flame .fl')].some(f=>f.textContent==='heavyWork')`)
  out.stats = await shellEval(`[...document.querySelectorAll('.prof .stat')].map(s=>s.innerText.replace(/\\s+/g,' '))`)
  srv.close()
  return out
}
