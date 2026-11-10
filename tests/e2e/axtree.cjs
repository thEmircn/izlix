module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const html = '<!doctype html><html lang="en"><title>ax</title><body><header><nav aria-label="Main nav"><a href="/x">Home</a></nav></header><main><h1>Title</h1><h4>Skipped level</h4><button id="ok">Save</button><button id="bad"></button><img src="data:image/gif;base64,R0lGODlhAQABAAAAACw="></main></body></html>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5198, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5198', workspaceId: 'default' }); await sleep(2000)
  await shellEval(`[...document.querySelectorAll('.rail > button')].find(b=>b.textContent==='A11y')?.click()`); await sleep(1200)
  await shellEval(`[...document.querySelectorAll('.a11y .seg2 button')].find(b=>b.textContent==='Tree')?.click()`); await sleep(1500)
  out.rows = await shellEval(`document.querySelectorAll('.ax-row').length`)
  out.roles = await shellEval(`[...document.querySelectorAll('.ax-role')].map(r=>r.textContent)`)
  out.issues = await shellEval(`[...document.querySelectorAll('.ax-issue')].map(r=>r.textContent)`)
  out.statIssues = await shellEval(`[...document.querySelectorAll('.axt .stat')].find(s=>s.textContent.includes('Issues'))?.querySelector('b')?.textContent`)
  // arama
  await shellEval(`(()=>{const i=document.querySelector('.axt input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'save');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(400)
  out.filtered = await shellEval(`[...document.querySelectorAll('.ax-name')].map(n=>n.textContent)`)
  srv.close(); return out
}
