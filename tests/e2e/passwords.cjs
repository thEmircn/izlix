module.exports = async ({ tabs, sleep, shellEval, pageEval, passwords }) => {
  const http = require('http'), out = {}
  const form = '<title>giris</title><form id="f" onsubmit="return false"><input id="u" name="user" type="text"><input id="p" name="pass" type="password"><button type="submit">Giris</button></form>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(form) })
  await new Promise((r) => srv.listen(5351, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5351/login', workspaceId: 'default' }); await sleep(2200)
  await pageEval(`document.getElementById('u').value='ali'; document.getElementById('p').value='gizli123'; document.getElementById('f').requestSubmit(); 1`); await sleep(1200)
  out.saved = JSON.stringify(passwords.getFor('http://localhost:5351'))
  const listed = await shellEval(`window.izlix.pwList().then(l => JSON.stringify(l))`)
  out.listHasNoPassword = !listed.includes('gizli123') && listed.includes('ali')
  // ayni kaynakta yeni sekme: anahtar rozeti + doldurma
  const id2 = await tabs.create({ url: 'http://localhost:5351/login', workspaceId: 'default' }); await sleep(2200)
  out.loginsInfo = tabs.list().tabs.find((t) => t.id === id2).logins
  out.chip = await shellEval(`document.querySelectorAll('.keybtn').length`)
  out.filled = await shellEval(`window.izlix.pwFill('${id2}')`); await sleep(500)
  out.values = await pageEval(`document.getElementById('u').value + '|' + document.getElementById('p').value`)
  // baska kaynak (127.0.0.1): kayit yok -> doldurma yok
  const id3 = await tabs.create({ url: 'http://127.0.0.1:5351/login', workspaceId: 'default' }); await sleep(2000)
  out.otherOriginFill = await shellEval(`window.izlix.pwFill('${id3}')`)
  // gizli sekmede kaydedilmez
  const id4 = await tabs.create({ url: 'http://127.0.0.1:5351/login', workspaceId: 'default', private: 'incognito' }); await sleep(2200)
  await pageEval(`document.getElementById('u').value='gizli'; document.getElementById('p').value='x1'; document.getElementById('f').requestSubmit(); 1`); await sleep(1200)
  out.privateNotSaved = passwords.getFor('http://127.0.0.1:5351').length === 0
  // sil
  await shellEval(`window.izlix.pwDelete('http://localhost:5351', 'ali')`); await sleep(600)
  out.deleted = passwords.getFor('http://localhost:5351').length === 0
  out.chipGone = tabs.list().tabs.find((t) => t.id === id2).logins === undefined
  srv.close(); return out
}
