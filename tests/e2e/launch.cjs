module.exports = async ({ tabs, workspaces, handleLaunch, sleep, detected }) => {
  const out = {}
  const dir = process.env.DB_TESTAPP
  await handleLaunch({ type: 'dir', dir }); await sleep(2500)
  out.workspaces = workspaces.list().map((w) => `${w.name}:${w.rootDir}`)
  out.tab = tabs.list().tabs.map((t) => t.url)
  await handleLaunch({ type: 'url', url: 'http://localhost:5173/?x=1' }); await sleep(1200)
  out.tabs2 = tabs.list().tabs.length
  return out
}
