// MVP #1: gecmis, yer imi, indirme
module.exports = async ({ tabs, library, downloads, sleep, shellEval, pageEval, app }) => {
  const http = require('http'), fs = require('fs')
  const srv = http.createServer((q, r) => {
    if (q.url === '/file') { r.writeHead(200, { 'content-type': 'application/octet-stream', 'content-disposition': 'attachment; filename="rapor.bin"' }); r.end(Buffer.alloc(200000, 1)) }
    else { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>Sayfam</title><a id=d href="/file">indir</a>') }
  }); await new Promise((r) => srv.listen(5198, '127.0.0.1', r))
  const out = {}
  const id = await tabs.create({ url: 'localhost:5198', workspaceId: 'default' }); await sleep(1800)
  out.history = library.recent().map((v) => `${v.title}|${v.url}`)
  out.bookmarkOn = await shellEval(`window.izlix.toggleBookmark(${JSON.stringify(id)})`)
  out.isBookmarked = library.isBookmarked('default', 'http://localhost:5198/')
  await sleep(400)
  out.star = await shellEval(`document.querySelector('[aria-label="Yer imi"]').textContent`)
  out.bookmarkOff = await shellEval(`window.izlix.toggleBookmark(${JSON.stringify(id)})`)
  // indirme: baglantiya tikla
  await pageEval(`document.querySelector('#d').click()`); await sleep(1500)
  const l = downloads.list()
  out.downloads = l.map((d) => ({ name: d.name, state: d.state, bytes: d.received }))
  out.fileExists = l[0] && fs.existsSync(l[0].path) && fs.statSync(l[0].path).size
  out.downloadChip = await shellEval(`[...document.querySelectorAll('.chip')].map(c=>c.textContent).find(t=>t.includes('⬇'))`)
  srv.close()
  return out
}
