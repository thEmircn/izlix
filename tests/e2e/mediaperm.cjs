module.exports = async ({ tabs, sleep, shellEval: se, pageEval, win }) => {
  const logs = []; win.webContents.on('console-message', (_e, lvl, msg) => { if (lvl >= 2) logs.push(String(msg).slice(0, 200)) })
  const shellEval = (c) => se(c).catch((e) => 'ERR:' + String(e).slice(0, 100))
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>m</title>x') })
  await new Promise((r) => srv.listen(5653, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5653', workspaceId: 'default' }); await sleep(2000)
  out.before = await pageEval(`navigator.permissions.query({name:'camera'}).then(s=>s.state)`)
  const p = pageEval(`navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(()=> 'ok', e=>e.name)`)
  for (let i = 0; i < 30 && !(await shellEval(`!!document.querySelector('[role=alertdialog]')`)); i++) await sleep(200)
  out.cardText = await shellEval(`document.querySelector('[role=alertdialog]')?.innerText.replace(/\\s+/g,' ').slice(0,90) ?? null`)
  await shellEval(`[...document.querySelectorAll('[role=alertdialog] button')].find(b=>b.textContent==='Always allow').click()`)
  out.result = await Promise.race([p, sleep(8000).then(() => 'timeout')])
  out.afterCam = await pageEval(`navigator.permissions.query({name:'camera'}).then(s=>s.state)`)
  out.afterMic = await pageEval(`navigator.permissions.query({name:'microphone'}).then(s=>s.state)`)
  out.logs = logs; srv.close(); return out
}
