// Next.js (Turbopack) uzerinde zincir + kaynak cozumleme
module.exports = async ({ tabs, sleep, click, bus, pageEval, win }) => {
  const out = {}
  const id = await tabs.create({ url: process.env.DB_URL || 'localhost:5176', workspaceId: 'default' }); await sleep(6000)
  await click('#load'); await sleep(2500)
  const ev = bus.snapshot(id)
  const req = ev.find((e) => e.kind === 'request' && /api\/items/.test(e.payload.url))
  const inp = ev.find((e) => e.kind === 'input' && e.payload.target === 'button#load')
  const has = (e, from, type) => e.links.some((l) => l.from === from.id && l.type === type)
  const res = req && ev.find((e) => e.kind === 'response' && has(e, req, 'request→response'))
  const rnd = res && ev.find((e) => e.kind === 'render' && has(e, res, 'response→render'))
  out.chain = { input: !!inp, request: !!req && !!inp && has(req, inp, 'input→request'), response: !!res, render: !!rnd }
  out.origin = req && req.payload.origin && { component: req.payload.origin.component, file: String(req.payload.origin.file).split('/').slice(-3).join('/'), line: req.payload.origin.line }
  const tree = await win.webContents.executeJavaScript(`window.izlix.inspectTree(${JSON.stringify(id)})`)
  out.nodes = tree && tree.nodes.length; out.names = tree && [...new Set(tree.nodes.map((n) => n.name))].slice(0, 12)
  return out
}
