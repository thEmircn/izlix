// getDisplayMedia duman testi: macOS sistem secicisi kullanilir (gorunmez test penceresinde secici iptal olur -> AbortError); isleyici yedegi secici yoksa devreye girer
module.exports = async ({ tabs, sleep, displayRequests, perms }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>s</title>x') })
  await new Promise((r) => srv.listen(5521, '127.0.0.1', r))
  perms.set('http://localhost:5521', 'display-capture', 'allow') // izin istemi onceden verildi: yalnizca secici isleyicisi denenir
  const id = await tabs.create({ url: 'http://localhost:5521/', workspaceId: 'default' }); await sleep(1800)
  const wc = tabs.get(id).view.webContents
  const before = displayRequests()
  out.result = await wc.executeJavaScript(`navigator.mediaDevices.getDisplayMedia({ video: true }).then(() => 'granted', (e) => e.name)`, true)
  out.handlerCalled = displayRequests() > before
  srv.close(); return out
}
