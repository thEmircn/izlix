module.exports = async ({ tabs, sleep, shellEval: se, pageEval }) => {
  const http = require('http'), out = { errs: [] }
  const shellEval = (c) => se(c).catch(() => { out.errs.push(c.slice(0, 80)); return null })
  let n = 0
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/api/user')) { n++; r.writeHead(n === 1 ? 200 : 500, { 'content-type': 'application/json' }); r.end(n === 1 ? '{"id":1,"name":"Ada","tags":["a","b"]}' : '{"error":"boom","code":500,"detail":{"x":1}}'); return }
    if (q.url.startsWith('/graphql')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"data":{"user":{"name":"Ada"}}}'); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>nl</title>')
  })
  await new Promise((r) => srv.listen(5195, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5195', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`fetch('/api/user').then(()=>fetch('/api/user')).then(()=>fetch('/graphql',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({operationName:'GetUser',query:'query GetUser($id: ID!) { user(id: $id) { name } }',variables:{id:7}})})); 1`); await sleep(1500)
  const rail = (n) => shellEval(`[...document.querySelectorAll('.rail > button')].find(b=>b.textContent==='${n}')?.click()`)
  const dtab = (n) => shellEval(`[...document.querySelectorAll('.drawer .seg2 button')].find(b=>b.textContent==='${n}')?.click()`)
  await rail('Network'); await sleep(900)
  out.gqlTag = await shellEval(`document.querySelector('.gqltag')?.textContent`)
  // ikinci /api/user satiri
  await shellEval(`[...document.querySelectorAll('.net-row')].filter(r=>r.textContent.includes('user')&&!r.textContent.includes('graphql'))[1].click()`); await sleep(800)
  await dtab('Response'); await sleep(900)
  out.treeRows = await shellEval(`document.querySelectorAll('.jtree .jrow').length`)
  out.treeHasKey = await shellEval(`document.querySelector('.jtree')?.innerText.includes('error')`)
  await dtab('Compare'); await sleep(1200)
  out.cmpFields = await shellEval(`[...document.querySelectorAll('.cmp-row b')].map(b=>b.textContent)`)
  out.cmpStatus = await shellEval(`document.querySelector('.cmp-row')?.innerText.replace(/\\s+/g,' ')`)
  // graphql payload
  await shellEval(`[...document.querySelectorAll('.net-row')].find(r=>r.textContent.includes('graphql')).click()`); await sleep(800)
  await dtab('Payload'); await sleep(700)
  out.gqlHead = await shellEval(`document.querySelector('.gql-h')?.innerText.replace(/\\s+/g,' ')`)
  out.gqlQuery = await shellEval(`document.querySelector('.drawer-b pre.code')?.textContent.includes('GetUser')`)
  srv.close(); return out
}
