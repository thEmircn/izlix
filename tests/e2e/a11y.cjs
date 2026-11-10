module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http')
  const html = `<!doctype html><title></title><body style="background:#fff"><h1>Title</h1><h3>skip</h3><img src="x.png"><button id=b1></button><a href="/x" style="display:inline-block;width:30px;height:30px"></a><input id=name type=text><p id=low style="color:#bbb">low contrast text</p><p id=ok style="color:#000">fine</p><div id=dup></div><div id=dup></div><button id=tiny style="width:10px;height:10px;padding:0">x</button><div tabindex=3>t</div><div id=wide style="width:3000px;height:5px;background:#eee"></div>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5191, '127.0.0.1', r))
  const out = {}
  const id = await tabs.create({ url: 'localhost:5191', workspaceId: 'default' }); await sleep(2000)
  const r = await shellEval(`window.izlix.a11yAudit(${JSON.stringify(id)})`)
  out.rules = [...new Set(r.issues.map((i) => i.rule))].sort()
  out.contrastSel = (r.issues.find((i) => i.rule === 'color-contrast') || {}).selector
  out.okNotFlagged = !r.issues.some((i) => i.selector === '#ok')
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='A11y').click()`); await sleep(1800)
  out.groups = await shellEval(`document.querySelectorAll('.agroup').length`)
  await shellEval(`document.querySelector('.ahead').click()`); await sleep(400)
  out.items = await shellEval(`document.querySelectorAll('.aitem').length`)
  srv.close()
  return out
}
