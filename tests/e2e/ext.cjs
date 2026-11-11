module.exports = async ({ tabs, sleep, pageEval, settings, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>e</title>x') })
  await new Promise((r) => srv.listen(5652, '127.0.0.1', r))
  out.add = await shellEval(`window.izlix.extAdd()`)
  out.list = (await shellEval(`window.izlix.extList()`)).map((e) => e.name)
  out.saved = (settings.get().extensions ?? []).length
  await tabs.create({ url: 'http://localhost:5652/', workspaceId: 'default' }); await sleep(2500)
  out.attr = await pageEval(`document.documentElement.getAttribute('data-ext')`)
  await shellEval(`window.izlix.extRemove('/tmp/ext-try')`); out.after = (await shellEval(`window.izlix.extList()`)).length; out.savedAfter = (settings.get().extensions ?? []).length
  srv.close(); return out
}
