module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), out = {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-heap-')); process.env.DB_OUT_DIR = dir
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>h</title><script>window.big=Array.from({length:20000},(_, i)=>({i,s:"x"+i}))</script>') })
  await new Promise((r) => srv.listen(5491, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5491/', workspaceId: 'default' }); await sleep(1800)
  const r = await shellEval(`window.izlix.heapSnapshot()`)
  out.file = r && path.extname(r.file)
  out.mbPositive = !!r && r.mb > 0
  const head = r ? fs.readFileSync(r.file, { encoding: 'utf8', flag: 'r' }).slice(0, 40) : ''
  out.looksLikeSnapshot = head.startsWith('{"snapshot"')
  srv.close(); return out
}
