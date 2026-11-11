module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  // 1 sn 440 Hz sinus WAV (8 bit mono, 8 kHz), dongu
  const n = 8000, buf = Buffer.alloc(44 + n); buf.write('RIFF', 0); buf.writeUInt32LE(36 + n, 4); buf.write('WAVEfmt ', 8); buf.writeUInt32LE(16, 16); buf.writeUInt16LE(1, 20); buf.writeUInt16LE(1, 22); buf.writeUInt32LE(8000, 24); buf.writeUInt32LE(8000, 28); buf.writeUInt16LE(1, 32); buf.writeUInt16LE(8, 34); buf.write('data', 36); buf.writeUInt32LE(n, 40)
  for (let i = 0; i < n; i++) buf[44 + i] = 128 + Math.round(100 * Math.sin(2 * Math.PI * 440 * i / 8000))
  const srv = http.createServer((q, r) => { if (q.url === '/a.wav') { r.writeHead(200, { 'content-type': 'audio/wav' }); r.end(buf); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>ses</title><audio id="a" src="/a.wav" autoplay loop></audio>') })
  await new Promise((r) => srv.listen(5321, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5321/', workspaceId: 'default' }); await sleep(3500)
  const info = () => tabs.list().tabs.find((t) => t.id === id)
  out.audible = info().audible === true
  out.iconShown = await shellEval(`document.querySelectorAll('.tab-audio').length`)
  await shellEval(`window.izlix.muteTab('${id}', true)`); await sleep(1200)
  out.muted = info().muted === true
  out.mutedIcon = await shellEval(`document.querySelectorAll('.tab-audio.muted').length`)
  out.wcMuted = tabs.get(id).view.webContents.audioMuted
  await shellEval(`window.izlix.muteTab('${id}', false)`); await sleep(1500)
  out.unmuted = !info().muted && info().audible === true
  srv.close(); return out
}
