// Workspace'e ait yeni dev sunucusu baslayinca sekme otomatik acilir (secenek acikken)
module.exports = async ({ tabs, workspaces, settings, sleep, detected }) => {
  const cp = require('child_process'), fs = require('fs')
  const root = '/private/tmp/e2e-tmp/autoproj'; fs.mkdirSync(root, { recursive: true })
  workspaces.create('Auto', root)
  await sleep(3500) // ilk tarama bitsin
  const n0 = tabs.list().tabs.length
  settings.set({ autoOpen: true })
  const srv = cp.spawn(process.execPath.includes('Electron') ? '/usr/bin/env' : process.execPath, ['node', '-e', "require('http').createServer((q,r)=>r.end('<title>auto-app</title>')).listen(5993,'127.0.0.1')"], { cwd: root, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } })
  await sleep(6000)
  const out = { delta: tabs.list().tabs.length - n0, urls: tabs.list().tabs.map((t) => t.url).filter((u) => u.includes('5993')) }
  settings.set({ autoOpen: false }); srv.kill()
  return out
}
