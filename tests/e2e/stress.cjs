// Yogun render trafiginde bellek: olay tamponu ve shell yigini buyumesi
module.exports = async ({ app, tabs, bus, sleep, shellEval, pageEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173/?n=2000', workspaceId: 'default' }); await sleep(4000)
  const mem = async () => ({ mainHeapMB: Math.round(process.memoryUsage().heapUsed / 1048576), shellHeapMB: Math.round((await shellEval('performance.memory.usedJSHeapSize')) / 1048576) })
  out.start = await mem()
  await pageEval(`window.__st = setInterval(() => document.querySelector('#tick').click(), 40); 0`)
  const secs = Number(process.env.STRESS_SECS || 25)
  await sleep(secs * 1000)
  await pageEval(`clearInterval(window.__st); 0`)
  await sleep(500)
  const snap = bus.snapshot(id)
  out.events = snap.length
  out.renders = snap.filter((e) => e.kind === 'render').length
  const sample = snap.filter((e) => e.kind === 'render').slice(-50)
  out.avgRenderPayloadKB = sample.length ? +(sample.reduce((a, e) => a + JSON.stringify(e.payload).length, 0) / sample.length / 1024).toFixed(1) : 0
  out.end = await mem()
  out.projected15minMB = Math.round(out.renders / secs * 900 * out.avgRenderPayloadKB / 1024)
  return out
}
