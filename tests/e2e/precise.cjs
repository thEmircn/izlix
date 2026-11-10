// Hassas mod: bilesen konumu derleme zamaninda eklenir (src), source map cozumlemesi gerekmez
module.exports = async ({ tabs, sleep, click, bus }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5180', workspaceId: 'default' }); await sleep(3500)
  await click('#load'); await sleep(1800)
  const comps = []
  for (const e of bus.snapshot(id)) if (e.kind === 'render') for (const c of e.payload.components || []) comps.push(c)
  const byName = {}; for (const c of comps) if (!byName[c.name]) byName[c.name] = c
  out.src = Object.fromEntries(Object.entries(byName).map(([n, c]) => [n, c.src ? c.src.split('/').slice(-2).join('/') : null]))
  out.resolved = Object.fromEntries(Object.entries(byName).map(([n, c]) => [n, c.file ? `${c.file.split('/').pop()}:${c.line}` : null]))
  const req = bus.snapshot(id).find((e) => e.kind === 'request' && /api\/items/.test(e.payload.url))
  out.origin = req && req.payload.origin && `${req.payload.origin.component}@${String(req.payload.origin.file).split('/').pop()}:${req.payload.origin.line}`
  return out
}
