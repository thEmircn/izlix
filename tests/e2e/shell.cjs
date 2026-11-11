// MVP #1/#2: sekme acma suresi, Workspace izolasyonu, sunucu bulma suresi, cokme kurtarma, zincir
module.exports = async ({ tabs, workspaces, sleep, pageEval, click, bus, detectServers, shot }) => {
  const out = {}
  await sleep(1500)

  // sunucu bulma: dedektoru dogrudan calistir (kabul: 2 sn icinde)
  const t0 = Date.now(); const found = await detectServers(); out.detectMs = Date.now() - t0
  out.detectedPorts = found.map((f) => `${f.port}:${f.framework}`)

  // sekme acma suresi (olusturma -> goruntu eklendi)
  const times = []
  for (let i = 0; i < 5; i++) { const a = performance.now(); const id = await tabs.create({ url: 'about:blank', workspaceId: 'default', activate: true }); times.push(+(performance.now() - a).toFixed(0)); tabs.close(id) }
  out.tabOpenMs = times

  // Workspace izolasyonu: ayni origin, farkli bolum -> cerez gorunmemeli
  const wsB = workspaces.create('B', '/tmp/ws-b')
  const a = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`document.cookie = 'ws=A; path=/'; document.cookie`)
  const b = await tabs.create({ url: 'localhost:5173', workspaceId: wsB.id }); await sleep(1800)
  out.cookieInB = await pageEval('document.cookie')
  tabs.activate(a); await sleep(300)
  out.cookieInA = await pageEval('document.cookie')

  // zincir: tikla -> fetch -> state -> render (yeni uygulamada)
  await click('#load'); await sleep(1500)
  const ev = bus.snapshot(a)
  const has = (e, from, type) => e.links.some((l) => l.from === from.id && l.type === type)
  const inp = ev.find((e) => e.source === 'bridge:input' && e.payload.target === 'button#load')
  const req = inp && ev.find((e) => e.kind === 'request' && has(e, inp, 'input→request'))
  const res = req && ev.find((e) => e.kind === 'response' && has(e, req, 'request→response'))
  const rnd = res && ev.find((e) => e.source === 'bridge:commit' && has(e, res, 'response→render'))
  out.chain = { input: !!inp, request: !!req, response: !!res, render: !!rnd, origin: req && req.payload.origin && req.payload.origin.component }
  // saat normalizasyonu: zincir zaman sirasinda olmali
  out.clockOrdered = !!(inp && req && res && rnd && inp.ts <= req.ts && req.ts <= res.ts && res.ts <= rnd.ts)

  // cokme kurtarma: render sureci olduruldu -> sayfa geri gelmeli
  const wc = tabs.get(a).view.webContents
  wc.forcefullyCrashRenderer(); await sleep(2500)
  out.afterCrashUrl = wc.getURL(); out.afterCrashAlive = !wc.isCrashed()

  await sleep(500)
  await shot(require('os').tmpdir() + '/izlix-e2e-shell1.png')
  out.tabs = tabs.list().tabs.map((t) => `${t.workspaceId}:${t.url}`)
  return out
}
