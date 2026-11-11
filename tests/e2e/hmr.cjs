// Dosya kaydi -> Vite HMR bildirimi -> render (tahmini hmr→render baglantisi)
module.exports = async ({ tabs, bus, sleep }) => {
  const fs = require('fs')
  const f = require('path').join(process.env.DB_TESTAPP, 'src/App.tsx')
  const orig = fs.readFileSync(f, 'utf8')
  const out = {}
  try {
    const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3500)
    const before = bus.snapshot(id).length
    fs.writeFileSync(f, orig.replace('<h1>Test App</h1>', '<h1>Test App HMR</h1>')); await sleep(2500)
    const ev = bus.snapshot(id).slice(before)
    const hmr = ev.find((e) => e.kind === 'hmr')
    out.hmr = hmr && hmr.payload
    const render = ev.find((e) => e.kind === 'render' && e.links.some((l) => l.type === 'hmr→render'))
    out.linked = !!render && render.links.find((l) => l.type === 'hmr→render').from === (hmr && hmr.id)
  } finally { fs.writeFileSync(f, orig) }
  return out
}
