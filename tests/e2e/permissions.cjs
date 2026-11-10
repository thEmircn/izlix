module.exports = async ({ tabs, sleep, shellEval, pageEval, win }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>p</title>x') })
  await new Promise((r) => srv.listen(5189, '127.0.0.1', r))
  const id = await tabs.create({ url: 'localhost:5189', workspaceId: 'default' }); await sleep(2000)
  const ask = () => pageEval(`Notification.requestPermission()`)
  // 1) engelle
  const p1 = ask()
  await sleep(700)
  out.cardShown = await shellEval(`!!document.querySelector('[role=alertdialog]')`)
  out.cardText = await shellEval(`document.querySelector('[role=alertdialog]')?.innerText.replace(/\\s+/g,' ').slice(0,80)`)
  await shellEval(`[...document.querySelectorAll('[role=alertdialog] button')].find(b=>b.textContent==='Block').click()`)
  out.blocked = await p1
  // kayitli karar: sormadan reddedilir
  out.blockedAgain = await Promise.race([ask(), sleep(2000).then(() => 'timeout')])
  // 2) Ayarlar'dan sifirla, sonra her zaman izin ver
  win.webContents.send('ui:cmd', 'settings.open'); await sleep(700)
  out.listed = await shellEval(`[...document.querySelectorAll('.permrow')].map(r=>r.innerText.replace(/\\s+/g,' '))`)
  await shellEval(`document.querySelector('.permrow .link').click()`); await sleep(500)
  out.afterReset = await shellEval(`document.querySelectorAll('.permrow').length`)
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  const p2 = ask(); await sleep(700)
  await shellEval(`[...document.querySelectorAll('[role=alertdialog] button')].find(b=>b.textContent==='Always allow').click()`)
  out.allowed = await p2
  out.allowedAgain = await Promise.race([ask(), sleep(2000).then(() => 'timeout')])
  out.storedAllow = await pageEval(`Notification.permission`)
  srv.close()
  return out
}
