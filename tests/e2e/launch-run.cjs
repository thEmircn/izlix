module.exports = async ({ tabs, workspaces, handleLaunch, sleep, shellEval }) => {
  const out = {}
  await handleLaunch({ type: 'dir', dir: '/private/tmp/e2e-tmp/srvproj', run: true }); await sleep(7000)
  const w = workspaces.list().find((x) => x.rootDir === '/private/tmp/e2e-tmp/srvproj')
  out.ws = !!w
  out.tab = tabs.list().tabs.map((t) => t.url).find((u) => u.includes('5184'))
  out.status = (await shellEval(`window.izlix.serverInfo(${JSON.stringify(w.id)})`)).status
  await shellEval(`window.izlix.serverStop(${JSON.stringify(w.id)})`); await sleep(2000)
  return out
}
