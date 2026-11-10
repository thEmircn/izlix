module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const http = require('http'), out = {}
  const enc = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
  const mk = (p) => `${enc({ alg: 'HS256', typ: 'JWT' })}.${enc(p)}.signature`
  const now = Math.floor(Date.now() / 1000)
  const good = mk({ sub: 'user42', exp: now + 3600 }), old = mk({ sub: 'olduser', exp: now - 7200 })
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/me')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ refresh: old })); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>j</title><h1>x</h1>')
  })
  await new Promise((r) => srv.listen(5190, '127.0.0.1', r))
  const id = await tabs.create({ url: 'localhost:5190', workspaceId: 'default' }); await sleep(2000)
  await pageEval(`localStorage.setItem('token', ${JSON.stringify(good)}); fetch('/me', {headers: {Authorization: 'Bearer ${good}'}}).then(r=>r.text())`); await sleep(800)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.net-row')].find(r=>r.textContent.includes('me')).click()`); await sleep(700)
  out.reqJwt = await shellEval(`document.querySelector('.jwtcard')?.innerText.replace(/\\s+/g,' ')`)
  out.reqValid = await shellEval(`document.querySelector('.jwtcard')?.className`)
  await shellEval(`[...document.querySelectorAll('.drawer .seg2 button')].find(b=>b.textContent==='Response').click()`); await sleep(900)
  out.bodyJwt = await shellEval(`document.querySelector('.jwtcard')?.className + ' | ' + document.querySelector('.jbadge')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Storage').click()`); await sleep(600)
  await shellEval(`[...document.querySelectorAll('.st .seg2 button')].find(b=>b.textContent==='localStorage').click()`); await sleep(1000)
  out.tag = await shellEval(`!!document.querySelector('.jtag')`)
  out.storageCard = await shellEval(`document.querySelector('.jwtcard')?.innerText.includes('user42')`)
  srv.close()
  return out
}
