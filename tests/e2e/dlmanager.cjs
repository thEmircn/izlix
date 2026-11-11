module.exports = async ({ tabs, win, sleep, shellEval, downloads }) => {
  const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), out = {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-dl-')); process.env.DB_OUT_DIR = dir
  // yavas indirme: 40 parca x 20 KB, ~4 sn
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/slow')) { r.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="yavas.bin"', 'content-length': 40 * 20000 }); let i = 0; const t = setInterval(() => { r.write(Buffer.alloc(20000, 1)); if (++i >= 40) { clearInterval(t); r.end() } }, 100); r.on('close', () => clearInterval(t)); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>d</title>x')
  })
  await new Promise((r) => srv.listen(5561, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5561/', workspaceId: 'default' }); await sleep(1500)
  const wc = tabs.get(id).view.webContents
  wc.downloadURL('http://localhost:5561/slow'); await sleep(1500)
  const cur = () => downloads.list().slice(-1)[0]
  out.started = cur().state === 'progressing' && cur().name === 'yavas.bin'
  out.hasUrl = (cur().url || '').endsWith('/slow')
  // arayuz: satir + duraklat dugmesi
  win.webContents.send('ui:cmd', 'downloads.open'); await sleep(900)
  out.row = await shellEval(`document.querySelectorAll('.dl-row').length >= 1 && [...document.querySelectorAll('.dl-row .dl-act button')].some(b => b.textContent === 'Pause')`)
  const dlId = cur().id
  out.paused = await shellEval(`window.izlix.downloadAct('${dlId}', 'pause')`); await sleep(500)
  const r1 = cur().received; await sleep(1200); const r2 = cur().received
  out.stillWhilePaused = cur().paused === true && r2 - r1 < 40000
  out.resumeBtn = await shellEval(`[...document.querySelectorAll('.dl-row .dl-act button')].some(b => b.textContent === 'Resume')`)
  out.resumed = await shellEval(`window.izlix.downloadAct('${dlId}', 'resume')`); await sleep(5000)
  out.completed = cur().state === 'completed' && fs.existsSync(path.join(dir, 'yavas.bin')) && fs.statSync(path.join(dir, 'yavas.bin')).size === 800000
  // ikinci indirme: iptal
  wc.downloadURL('http://localhost:5561/slow2'); await sleep(1200)
  const id2 = cur().id
  out.cancelled = await shellEval(`window.izlix.downloadAct('${id2}', 'cancel')`); await sleep(800)
  out.cancelState = cur().state
  // listeden kaldir ve bitenleri temizle
  out.removed = await shellEval(`window.izlix.downloadAct('${id2}', 'remove')`); await sleep(300)
  out.removedGone = !downloads.list().some((d) => d.id === id2)
  await shellEval(`window.izlix.downloadAct('', 'clear')`); await sleep(300)
  out.cleared = downloads.list().filter((d) => d.state !== 'progressing').length === 0
  srv.close(); return out
}
