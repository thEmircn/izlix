module.exports = async ({ tabs, sleep, shellEval, pageEval, bus }) => {
  const out = {}
  const a = await tabs.create({ url: 'localhost:5173/?a', workspaceId: 'default' }); await sleep(1500)
  const b = await tabs.create({ url: 'localhost:5173/?b', workspaceId: 'default' }); await sleep(1500)
  const c = await tabs.create({ url: 'localhost:5173/?c', workspaceId: 'default' }); await sleep(1500)
  const n0 = tabs.list().tabs.length
  const d = await tabs.duplicate(b); await sleep(1500)
  out.dupUrl = tabs.get(d).info.url
  out.dupDelta = tabs.list().tabs.length - n0
  out.closedRight = tabs.closeOthers(b, true)
  out.afterRight = tabs.list().tabs.map((t) => t.url.split('?')[1]).filter(Boolean)
  out.closedOthers = tabs.closeOthers(b)
  out.remaining = tabs.list().tabs.length
  // cache + block kurali
  await tabs.setCacheDisabled(b, true); out.noCache = tabs.get(b).info.noCache
  await tabs.setCacheDisabled(b, false); out.noCacheOff = tabs.get(b).info.noCache ?? null
  return out
}
