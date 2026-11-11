module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), out = {}
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-exp-')); process.env.DB_OUT_DIR = dir
  const srv = http.createServer((q, r) => {
    if (q.url.startsWith('/api/items/7')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('{"id":7,"name":"Elma","price":2.5}'); return }
    if (q.url === '/api/items' && q.method === 'POST') { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { r.writeHead(201, { 'content-type': 'application/json' }); r.end('{"id":8}') }); return }
    r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>x</title>x')
  })
  await new Promise((r) => srv.listen(5611, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5611/', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`fetch('/api/items/7?x=1').then(r=>r.text()); fetch('/api/items',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({name:'B',qty:2})}).then(r=>r.text()); 1`); await sleep(1500)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(900)
  const run = async (v) => { await shellEval(`(()=>{const s=document.querySelector('.net-export');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'${v}');s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(2500) }
  await run('msw'); await run('postman'); await run('openapi')
  const files = fs.readdirSync(dir)
  out.files = files.map((f) => f.replace(/^[^-.]+/, 'H')).sort()
  const read = (suffix) => fs.readFileSync(path.join(dir, files.find((f) => f.endsWith(suffix))), 'utf8')
  const msw = read('-handlers.js'), pm = JSON.parse(read('.postman_collection.json')), oa = JSON.parse(read('.openapi.json'))
  out.mswHas = msw.includes("http.get('*/api/items/:id'") && msw.includes('"name": "Elma"') && msw.includes("http.post('*/api/items'")
  out.postman = pm.item.map((i) => i.name).sort()
  out.openapiPaths = Object.keys(oa.paths).sort()
  out.openapiSchema = oa.paths['/api/items/{id}'].get.responses['200'].content['application/json'].schema.properties.price.type
  out.noSecrets = !/authorization|cookie/i.test(msw + JSON.stringify(pm))
  srv.close(); return out
}
