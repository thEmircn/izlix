module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const http = require('http'), os = require('os'), out = {}
  // gercek LAN IP'si (ag yoksa karsilastirmalar atlanir)
  let ip = null; for (const l of Object.values(os.networkInterfaces())) for (const i of l || []) if (i.family === 'IPv4' && !i.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(i.address)) ip = ip || i.address
  out.hasLan = !!ip
  const mk = (port, host) => new Promise((r) => { const s = http.createServer((q, res) => { res.writeHead(200, { 'content-type': 'text/html' }); res.end('<title>lan</title>x') }); s.listen(port, host, () => r(s)) })
  const open = await mk(5531, '0.0.0.0'), closed = await mk(5532, '127.0.0.1')
  const a = await tabs.create({ url: 'http://localhost:5531/yol?x=1', workspaceId: 'default' }); await sleep(1800)
  win.webContents.send('ui:cmd', 'qr.open'); await sleep(1800)
  out.tabs = await shellEval(`document.querySelectorAll('.dialog .seg2 button').length`)
  out.shownUrl = await shellEval(`document.querySelector('.dialog .shint')?.textContent`)
  out.okMsg = await shellEval(`document.body.textContent.includes('Reachable on your local network')`)
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(400)
  // yalniz loopback'e bagli sunucu: erisilemez uyarisi
  await tabs.create({ url: 'http://localhost:5532/', workspaceId: 'default' }); await sleep(1800)
  win.webContents.send('ui:cmd', 'qr.open'); await sleep(1800)
  out.warnMsg = await shellEval(`document.body.textContent.includes('Not reachable at')`)
  // loopback olmayan sayfa: LAN sekmesi yok
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  open.close(); closed.close(); out.ip = ip; return out
}
