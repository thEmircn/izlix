// Odak modu + kullanim suresi (example.com icin ag gerekir)
module.exports = async ({ tabs, win, sleep, shellEval, settings, usage }) => {
  const http = require('http'), out = {}
  process.env.DB_TRACK_ALWAYS = '1' // test penceresi odakta degil: takibi zorla
  const get = (url) => new Promise((r) => http.get(url, (res) => { res.resume(); r(res.statusCode) }).on('error', () => r(0)))
  const id = await tabs.create({ url: 'https://example.com/', workspaceId: 'default' }); await sleep(5500)
  const wc = tabs.get(id).view.webContents
  out.online = wc.getURL().startsWith('https://example.com')
  out.tracked = !out.online || usage().usedToday('example.com') >= 3
  // odak modu acilinca acik sayfa engel sayfasina doner
  await shellEval(`window.izlix.setSettings({ focus: { on: true, sites: ['example.com'], limits: {} } })`); await sleep(3000)
  out.blockedPage = /^http:\/\/127\.0\.0\.1:\d+\/b\//.test(wc.getURL())
  out.blockText = await wc.executeJavaScript(`document.body.textContent`).catch(() => '')
  out.chip = await shellEval(`document.querySelectorAll('.focuschip').length`)
  // yeni gezinme de engellenir
  tabs.go(id, 'example.com'); await sleep(1500)
  out.goBlocked = /^http:\/\/127\.0\.0\.1:\d+\/b\//.test(wc.getURL())
  // 5 dk izin: hedefe yonlendirir ve ayara snooze yazar
  const allow = await wc.executeJavaScript(`document.querySelector('a.b').href`)
  await wc.executeJavaScript(`document.querySelector('a.b').click()`); await sleep(5000)
  out.snoozed = (settings.get().focus.snooze || {})['example.com'] > Date.now()
  out.afterAllow = !out.online || wc.getURL().startsWith('https://example.com')
  out.tokenOnce = await get(allow) // ikinci kullanim reddedilir
  // limit: bugunluk sure limiti asarsa engel (snooze kalkmis olarak)
  settings.set({ focus: { on: false, sites: [], limits: { 'example.com': 1 } } })
  usage().add('example.com', 200)
  tabs.go(id, 'https://example.com/'); await sleep(1500)
  out.limitPage = (await wc.executeJavaScript(`document.body.textContent`).catch(() => '')).includes('daily limit of 1 min')
  // odak modunu engel sayfasindan kapat
  settings.set({ focus: { on: true, sites: ['example.com'], limits: {} } })
  tabs.go(id, 'https://example.com/'); await sleep(1500)
  const off = await wc.executeJavaScript(`[...document.querySelectorAll('a.b')].find(a => a.textContent.includes('Turn off')).click(); 1`).catch(() => 0); await sleep(4000)
  out.focusOff = settings.get().focus.on === false
  // kullanim sayfasi
  win.webContents.send('ui:cmd', 'usage.open'); await sleep(1000)
  out.usageRows = await shellEval(`[...document.querySelectorAll('.usage-row span')].map(s => s.textContent)`)
  return out
}
