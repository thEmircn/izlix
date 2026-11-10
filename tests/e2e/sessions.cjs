module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(`<title>${q.url.slice(1)}</title>${q.url}`) })
  await new Promise((r) => srv.listen(5197, '127.0.0.1', r))
  const a = await tabs.create({ url: 'localhost:5197/one', workspaceId: 'default' }); await sleep(900)
  const b = await tabs.create({ url: 'localhost:5197/two', workspaceId: 'default' }); await sleep(900)
  const c = await tabs.create({ url: 'localhost:5197/three', workspaceId: 'default' }); await sleep(900)
  tabs.activate(a); tabs.setSplit(b); await sleep(300); tabs.activate(c); await sleep(300)
  out.savedId = await shellEval(`window.izlix.saveSession('Aksam')`)
  await sleep(500)
  out.listed = await shellEval(`new Promise(r=>{let n=0;const h=setInterval(()=>{n++; const s=[...document.querySelectorAll('x')]; if(n>3){clearInterval(h);r(1)}},50)})`)
  // her sekmeyi kapat, sadece birini birak
  for (const id of [a, b]) tabs.close(id); await sleep(500)
  out.tabsBefore = tabs.list().tabs.length
  out.opened = await shellEval(`window.izlix.openSession(${JSON.stringify(out.savedId)})`); await sleep(2500)
  const urls = tabs.list().tabs.map((t) => t.url.replace(/^.*:5197/, ''))
  out.tabsAfter = urls.length
  out.hasAll = ['/one', '/two', '/three'].every((u) => urls.includes(u))
  out.splitRestored = tabs.splitIds.length === 2
  // replace: mevcut sekmeler kapanir, yalnizca oturumunki kalir
  out.replaced = await shellEval(`window.izlix.openSession(${JSON.stringify(out.savedId)}, true)`); await sleep(2500)
  out.afterReplace = tabs.list().tabs.length
  // silme
  out.deleted = await shellEval(`window.izlix.deleteSession(${JSON.stringify(out.savedId)})`); await sleep(300)
  out.gone = await shellEval(`new Promise(r=>r(window.izlix.openSession(${JSON.stringify(out.savedId)})))`)
  srv.close(); return out
}
