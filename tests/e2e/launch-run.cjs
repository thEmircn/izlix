module.exports = async ({ tabs, workspaces, handleLaunch, sleep, shellEval }) => {
  const out = {}
  const fsx = require('fs'), rootx = require('os').tmpdir() + '/izlix-e2e-srvproj'; fsx.mkdirSync(rootx, { recursive: true })
  fsx.writeFileSync(rootx + '/package.json', JSON.stringify({ name: 'srvproj', scripts: { dev: 'node server.js' } }))
  fsx.writeFileSync(rootx + '/server.js', "require('http').createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>srv-app</title>hello') }).listen(5184, () => { console.log('  VITE ready'); console.log('  http://localhost:5184/') })")
  await handleLaunch({ type: 'dir', dir: require('os').tmpdir() + '/izlix-e2e-srvproj', run: true }); await sleep(7000)
  const w = workspaces.list().find((x) => x.rootDir === require('os').tmpdir() + '/izlix-e2e-srvproj')
  out.ws = !!w
  out.tab = tabs.list().tabs.map((t) => t.url).find((u) => u.includes('5184'))
  out.status = (await shellEval(`window.izlix.serverInfo(${JSON.stringify(w.id)})`)).status
  await shellEval(`window.izlix.serverStop(${JSON.stringify(w.id)})`); await sleep(2000)
  return out
}
