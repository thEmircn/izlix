// Dev sunucusu kapaliyken aciklayici sayfa; sunucu acilinca otomatik acilir
module.exports = async ({ tabs, sleep }) => {
  const http = require('http')
  const out = {}
  const id = await tabs.create({ url: 'localhost:5994', workspaceId: 'default' }); await sleep(1500)
  const wc = tabs.get(id).view.webContents
  out.errorBody = await wc.executeJavaScript('document.body.innerText.slice(0, 200)')
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>now-up</title>ok') })
  await new Promise((r) => srv.listen(5994, '127.0.0.1', r))
  await sleep(5000)
  out.afterStart = wc.getTitle()
  srv.close()
  return out
}
