module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), out = {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-out-')); process.env.DB_OUT_DIR = dir
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<title>Yazdirilacak Sayfa</title><h1>Merhaba PDF</h1><p>icerik</p>') })
  await new Promise((r) => srv.listen(5381, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5381/', workspaceId: 'default' }); await sleep(2000)
  const pdf = await shellEval(`window.izlix.printPage('pdf')`)
  out.pdfPath = pdf && path.basename(pdf)
  out.pdfMagic = pdf ? fs.readFileSync(pdf).subarray(0, 5).toString() : null
  out.pdfSize = pdf ? fs.statSync(pdf).size > 1000 : false
  const html = await shellEval(`window.izlix.printPage('save')`)
  out.htmlSaved = html ? fs.readFileSync(html, 'utf8').includes('Merhaba PDF') : false
  // sayfa degilse (about:blank) null
  await tabs.create({ workspaceId: 'default' }); await sleep(800)
  out.blankNull = await shellEval(`window.izlix.printPage('pdf')`)
  srv.close(); return out
}
