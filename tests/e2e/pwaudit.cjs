module.exports = async ({ tabs, win, sleep, shellEval, pageEval }) => {
  const http = require('http'), { createHash } = require('crypto'), out = {}
  const h = createHash('sha1').update('123456').digest('hex').toUpperCase()
  process.env.DB_PWNED_RANGE = `${h.slice(5)}:777\nAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA:2`
  const form = '<title>g</title><form id="f" onsubmit="return false"><input id="u" type="text"><input id="p" type="password"><button>Giris</button></form>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(form) })
  await new Promise((r) => srv.listen(5571, '127.0.0.1', r))
  for (const host of ['localhost', '127.0.0.1']) {
    await tabs.create({ url: `http://${host}:5571/`, workspaceId: 'default' }); await sleep(1800)
    await pageEval(`document.getElementById('u').value='kullanici'; document.getElementById('p').value='123456'; document.getElementById('f').requestSubmit(); 1`); await sleep(2400)
  }
  win.webContents.send('ui:cmd', 'settings.open'); await sleep(900)
  out.genLen = await shellEval(`[...document.querySelectorAll('.pwrow b')].find(b => getComputedStyle(b).fontFamily.includes('mono'))?.textContent.length`)
  await shellEval(`[...document.querySelectorAll('.pwrow .btn')].find(b => b.textContent === 'Check weak/reused').click()`); await sleep(800)
  out.localBadges = await shellEval(`[...document.querySelectorAll('.pwrow .chip')].map(c => c.textContent)`)
  await shellEval(`[...document.querySelectorAll('.pwrow .btn')].find(b => b.textContent === 'Also check breaches').click()`); await sleep(1500)
  out.breachBadges = await shellEval(`[...document.querySelectorAll('.pwrow .chip')].map(c => c.textContent)`)
  srv.close(); return out
}
