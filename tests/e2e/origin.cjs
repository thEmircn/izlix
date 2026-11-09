module.exports = async ({ tabs, sleep, click, bus, pageEval }) => {
  await sleep(1200)
  const a = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  await click('#load'); await sleep(2200)
  const ev = bus.snapshot(a)
  const req = ev.find((e) => e.kind === 'request' && e.payload.type === 'Fetch')
  const comps = ev.filter((e) => e.source === 'bridge:commit').flatMap((e) => e.payload.components).filter((c) => c.file).map((c) => `${c.name}@${c.file.split('/').slice(-2).join('/')}:${c.line}`)
  return { origin: req && req.payload.origin, comps: [...new Set(comps)] }
}
