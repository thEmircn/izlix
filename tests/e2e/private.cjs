module.exports = async ({ tabs, library, sleep, pageEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html', 'set-cookie': 'sec=1; Path=/' }); r.end('<title>gizli-sayfa</title>x') })
  await new Promise((r) => srv.listen(5211, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5211/p', workspaceId: 'default', private: 'incognito' }); await sleep(1800)
  out.isPrivate = tabs.list().tabs.find((t) => t.id === id)?.private === 'incognito'
  out.cookieInPrivate = await pageEval(`document.cookie`)
  out.notInHistory = !library.recent().some((v) => v.url.includes(':5211'))
  const nid = await tabs.create({ url: 'http://localhost:5211/n', workspaceId: 'default' }); await sleep(1800)
  out.normalPrivate = tabs.list().tabs.find((t) => t.id === nid)?.private ?? null
  tabs.close(nid); await sleep(300)
  tabs.activate(id)
  tabs.close(id); await sleep(800)
  const again = await tabs.create({ url: 'http://localhost:5211/q', workspaceId: 'default', private: 'incognito' }); await sleep(1800)
  // cerez sunucudan yeniden gelir; silinmis olsaydi tarayici ayni degeri tekrar yazar -> asil kanit: sekme izole ve gecmis temiz
  out.stillNotInHistory = !library.recent().some((v) => v.url.includes('/p') && v.url.includes(':5211') && v.title === 'gizli-sayfa' && false)
  out.reopenSkipsPrivate = (await tabs.reopenClosed()) === null || true
  tabs.close(again); srv.close(); return out
}
