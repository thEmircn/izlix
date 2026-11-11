module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(q.url === '/en' ? '<html lang="en"><title>en</title><p>hello</p>' : '<html lang="de"><title>de</title><p>hallo welt</p>') })
  await new Promise((r) => srv.listen(5421, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5421/de', workspaceId: 'default' }); await sleep(2200)
  const info = () => tabs.list().tabs.find((t) => t.id === id)
  out.lang = info().lang
  out.chip = await shellEval(`[...document.querySelectorAll('.transchip')].map(c=>c.textContent)`)
  await shellEval(`window.izlix.translateTab('${id}')`); for (let i = 0; i < 40 && !tabs.get(id).view.webContents.getURL().startsWith('https://translate.google.com'); i++) await sleep(200)
  out.fromSet = info().translatedFrom
  out.goesToTranslate = tabs.get(id).view.webContents.getURL().startsWith('https://translate.google.com/translate?') || info().url.startsWith('https://translate.google.com')
  out.targetLang = new URL(tabs.get(id).view.webContents.getURL() || 'http://x').searchParams.get('tl')
  out.originalChip = await shellEval(`[...document.querySelectorAll('.transchip.on')].length`)
  await shellEval(`window.izlix.translateTab('${id}', true)`); for (let i = 0; i < 50 && !(info().url === 'http://localhost:5421/de' && info().translatedFrom === undefined); i++) await sleep(200)
  out.backOriginal = info().url === 'http://localhost:5421/de'
  out.fromCleared = info().translatedFrom === undefined
  // uygulama dilindeki sayfada oneri yok
  const id2 = await tabs.create({ url: 'http://localhost:5421/en', workspaceId: 'default' }); await sleep(2000)
  out.noChipSameLang = (await shellEval(`document.querySelectorAll('.transchip').length`)) === 0
  srv.close(); return out
}
