module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>q</title>x') })
  await new Promise((r) => srv.listen(5461, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5461/qrtest?a=1', workspaceId: 'default' }); await sleep(1800)
  win.webContents.send('ui:cmd', 'qr.open'); await sleep(800)
  out.dialog = await shellEval(`!!document.querySelector('[role=dialog][aria-label="QR code"]')`)
  out.svg = await shellEval(`!!document.querySelector('.qrbox svg')`)
  out.cells = await shellEval(`document.querySelectorAll('.qrbox svg rect, .qrbox svg path').length`)
  await shellEval(`[...document.querySelectorAll('.dialog .seg2 button')].find(b=>b.textContent==='Page address')?.click()`); await sleep(400)
  out.url = await shellEval(`document.querySelector('.dialog .shint')?.textContent`)
  srv.close(); return out
}
