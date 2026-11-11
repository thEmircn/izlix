module.exports = async ({ tabs, sleep, shellEval, click, win }) => {
  const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), out = {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-rec-')); process.env.DB_OUT_DIR = dir
  const page = '<title>rec</title><form onsubmit="return false"><input placeholder="E-posta"><input type="password" placeholder="Sifre"><button type="submit">Giris</button></form>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page) })
  await new Promise((r) => srv.listen(5471, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5471/', workspaceId: 'default' }); await sleep(1800)
  const wc = tabs.active().view.webContents
  out.started = await shellEval(`window.izlix.recStart()`); await sleep(500)
  await click('input[placeholder="E-posta"]'); await sleep(200); wc.insertText('ali'); await sleep(900)
  await click('input[type=password]'); await sleep(200); wc.insertText('gizli123'); await sleep(900)
  wc.sendInputEvent({ type: 'keyDown', keyCode: 'Enter' }); wc.sendInputEvent({ type: 'keyUp', keyCode: 'Enter' }); await sleep(400)
  await click('button[type=submit]'); await sleep(600)
  out.chip = await shellEval(`document.querySelectorAll('.recchip').length`)
  // chip'e tikla: durdurur ve sonuc penceresini acar
  await shellEval(`document.querySelector('.recchip').click()`); await sleep(1000)
  const labels = await shellEval(`[...document.querySelectorAll('.rec-step code')].map(c=>c.textContent)`)
  out.stepTypes = labels.map((l) => l.split(/\s+/)[0])
  out.fillEmail = labels.find((l) => l.startsWith('fill') && l.includes('E-posta')) || ''
  out.secret = labels.find((l) => l.startsWith('fill') && l.includes('Sifre')) || ''
  out.leak = (await shellEval(`document.querySelector('.dialog.rec').textContent + document.querySelector('.rec-code').value`)).includes('gizli123')
  out.chipGone = await shellEval(`document.querySelectorAll('.recchip').length`) === 0
  // dialog + dosya
  out.dialog = await shellEval(`!!document.querySelector('.dialog.rec')`)
  out.code = await shellEval(`document.querySelector('.rec-code')?.value || ''`)
  const f = await shellEval(`window.izlix.recSave(document.querySelector('.rec-code').value, 'giris akisi')`)
  out.saved = f ? fs.readFileSync(f, 'utf8').includes("getByPlaceholder('E-posta')") : false
  out.fileName = f && path.basename(f)
  srv.close(); return out
}
