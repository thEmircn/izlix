module.exports = async ({ tabs, workspaces, win, sleep, shellEval }) => {
  const net = require('net'), out = {}
  const root = require('os').tmpdir() + '/izlix-e2e-srvproj'
  const w = workspaces.create('SrvProj', root)
  await shellEval(`window.izlix.switchWorkspace(${JSON.stringify(w.id)})`); await sleep(800)
  const info = await shellEval(`window.izlix.serverInfo(${JSON.stringify(w.id)})`)
  out.scripts = info.scripts.map((s) => s.name); out.pm = info.pm; out.firstLikely = info.scripts[0].name
  out.reject = await shellEval(`window.izlix.serverStart(${JSON.stringify(w.id)}, 'nonexistent')`)
  const n0 = tabs.list().tabs.length
  out.started = await shellEval(`window.izlix.serverStart(${JSON.stringify(w.id)}, 'dev')`)
  out.doubleStart = await shellEval(`window.izlix.serverStart(${JSON.stringify(w.id)}, 'dev')`)
  await sleep(6000)
  const i2 = await shellEval(`window.izlix.serverInfo(${JSON.stringify(w.id)})`)
  out.status = i2.status; out.url = i2.url
  out.logHasUrl = i2.lines.some((l) => l.includes('Local:') && l.includes('5184')); out.noAnsi = !i2.lines.some((l) => l.includes('\u001b'))
  out.tabOpened = tabs.list().tabs.length - n0
  out.tabUrl = tabs.list().tabs.map((t) => t.url).find((u) => u.includes('5184'))
  // panel arayuzu
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Server').click()`); await sleep(900)
  out.ui = await shellEval(`document.querySelector('.srvstat')?.innerText.replace(/\\s+/g,' ')`)
  out.logUi = await shellEval(`document.querySelector('.srv-log')?.innerText.includes('Local:')`)
  // durdur
  await shellEval(`window.izlix.serverStop(${JSON.stringify(w.id)})`); await sleep(2500)
  out.afterStop = (await shellEval(`window.izlix.serverInfo(${JSON.stringify(w.id)})`)).status
  out.portFree = await new Promise((r) => { const s = net.connect(5184, '127.0.0.1'); s.on('connect', () => { s.destroy(); r(false) }); s.on('error', () => r(true)) })
  return out
}
