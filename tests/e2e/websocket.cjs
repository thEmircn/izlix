module.exports = async ({ tabs, sleep, shellEval, pageEval, bus }) => {
  const http = require('http'), crypto = require('crypto')
  const frame = (txt) => { const b = Buffer.from(txt); return Buffer.concat([Buffer.from([0x81, b.length]), b]) }
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>ws</title>ok') })
  srv.on('upgrade', (req, sock) => {
    const key = crypto.createHash('sha1').update(req.headers['sec-websocket-key'] + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64')
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${key}\r\n\r\n`)
    sock.write(frame('{"hello":"server"}'))
    sock.on('data', (d) => { const len = d[1] & 0x7f; const mask = d.slice(2, 6); const pl = Buffer.from(d.slice(6, 6 + len).map((x, i) => x ^ mask[i % 4])); sock.write(frame('echo:' + pl.toString())) })
  })
  await new Promise((r) => srv.listen(5192, '127.0.0.1', r))
  const out = {}
  const id = await tabs.create({ url: 'localhost:5192', workspaceId: 'default' }); await sleep(2000)
  await pageEval(`window.ws=new WebSocket('ws://localhost:5192/live'); new Promise(r=>{ws.onopen=()=>{ws.send('ping1');ws.send('ping2');setTimeout(()=>{ws.close();r(1)},600)}})`); await sleep(900)
  const ws = bus.snapshot(id).filter((e) => e.kind === 'ws')
  out.dirs = ws.map((e) => e.payload.dir)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(600)
  await shellEval(`[...document.querySelectorAll('.fchip')].find(b=>b.textContent.startsWith('ws')).click()`); await sleep(300)
  out.rows = await shellEval(`[...document.querySelectorAll('.net-row')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  await shellEval(`document.querySelector('.net-row').click()`); await sleep(700)
  out.msgs = await shellEval(`[...document.querySelectorAll('.ws-row')].map(r=>r.innerText.replace(/\\s+/g,' ').slice(0,40))`)
  srv.close()
  return out
}
