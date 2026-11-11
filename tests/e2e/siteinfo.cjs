module.exports = async ({ tabs, win, sleep, shellEval, settings }) => {
  const out = {}
  settings.set({ httpsOnly: true })
  const id = await tabs.create({ url: 'https://example.com/', workspaceId: 'default' }); await sleep(5000)
  out.online = tabs.list().tabs.find((t) => t.id === id).url.startsWith('https://example.com')
  win.webContents.send('ui:cmd', 'site.open'); await sleep(900)
  const text = await shellEval(`document.querySelector('.dialog')?.textContent || ''`)
  out.secureShown = !out.online || text.includes('Encrypted connection (HTTPS)')
  out.tlsShown = !out.online || /TLS 1\.[23]/.test(text)
  out.issuerShown = !out.online || text.includes('Issued by')
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(400)
  // http (loopback) sayfada: sifresiz uyarisi
  const http = require('http'); const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>x</title>x') })
  await new Promise((r) => srv.listen(5451, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5451/', workspaceId: 'default' }); await sleep(1800)
  win.webContents.send('ui:cmd', 'site.open'); await sleep(900)
  out.httpWarn = (await shellEval(`document.querySelector('.dialog')?.textContent || ''`)).includes('Not encrypted')
  srv.close(); return out
}
