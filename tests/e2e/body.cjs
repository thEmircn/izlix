module.exports = async ({ tabs, bus, sleep, click, shellEval }) => {
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(300); await click('#fail'); await sleep(1500)
  const reqs = bus.snapshot(id).filter((e) => e.kind === 'request' && /api\/items/.test(e.payload.url))
  const out = {}
  for (const r of reqs) {
    try { const x = await tabs.get(id).view.webContents.debugger.sendCommand('Network.getResponseBody', { requestId: r.payload.requestId }); out[r.payload.url] = x.body.slice(0, 30) } catch (e) { out[r.payload.url] = 'ERR ' + e.message }
    out[r.payload.url + ':ipc'] = await shellEval(`window.izlix.responseBody(${JSON.stringify(id)}, ${JSON.stringify(r.payload.requestId)})`)
  }
  return out
}
