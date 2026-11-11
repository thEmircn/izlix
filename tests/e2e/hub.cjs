module.exports = async ({ tabs, sleep, shellEval: se, pageEval, settings, win }) => {
  const shellEval = (c) => se(c).catch((e) => 'ERR:' + c.slice(0, 60))
  const http = require('http'), { session } = require('electron'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>(4) Tracker</title>x') })
  await new Promise((r) => srv.listen(5654, '127.0.0.1', r))
  out.noUrl = await shellEval(`window.izlix.hubOpen('youtrack')`)
  await shellEval(`window.izlix.setSettings({ hub: { enabled: ['whatsapp', 'youtrack', 'meet'], urls: { youtrack: 'http://127.0.0.1:5654/' }, autostart: false } })`)
  out.open = await shellEval(`window.izlix.hubOpen('youtrack')`); await sleep(2200)
  const t = tabs.list().tabs.find((x) => x.service === 'youtrack')
  out.hasTab = !!t; out.unread = t?.unread; out.pinned = !!t?.pinned
  const e = tabs.get(t.id)
  out.ownSession = e.view.webContents.session === session.fromPartition('persist:svc-youtrack')
  out.notif = await pageEval(`Notification.requestPermission()`)
  out.sleepOthers = tabs.sleepOthers(); out.stillAwake = !tabs.get(t.id).info.sleeping
  out.again = await shellEval(`window.izlix.hubOpen('youtrack')`); out.count = tabs.list().tabs.filter((x) => x.service === 'youtrack').length
  win.webContents.send('ui:cmd', 'svch.open'); await sleep(700)
  out.cardOn = await shellEval(`!!document.querySelector('[data-testid=svc-youtrack]') && !document.querySelector('[data-testid=svc-youtrack]').classList.contains('off')`)
  out.cardCount = await shellEval(`document.querySelector('[data-testid=svc-youtrack] .svc-count').textContent`)
  out.total = await shellEval(`document.querySelector('[data-testid=hub-total]').textContent`)
  out.waOff = await shellEval(`document.querySelector('[data-testid=svc-telegram]').classList.contains('off')`)
  out.next = await shellEval(`window.izlix.hubNext()`)
  srv.close(); return out
}
