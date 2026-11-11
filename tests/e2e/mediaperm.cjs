module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>m</title>x') })
  await new Promise((r) => srv.listen(5653, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5653', workspaceId: 'default' }); await sleep(2000)
  out.before = await pageEval(`navigator.permissions.query({name:'camera'}).then(s=>s.state)`)
  const p = pageEval(`navigator.mediaDevices.getUserMedia({video:true,audio:true}).then(()=> 'ok', e=>e.name)`)
  await sleep(900)
  out.cardText = await shellEval(`document.querySelector('[role=alertdialog]')?.innerText.replace(/\\s+/g,' ').slice(0,90) ?? null`)
  await shellEval(`[...document.querySelectorAll('[role=alertdialog] button')].find(b=>b.textContent==='Always allow').click()`)
  out.result = await Promise.race([p, sleep(8000).then(() => 'timeout')])
  out.afterCam = await pageEval(`navigator.permissions.query({name:'camera'}).then(s=>s.state)`)
  out.afterMic = await pageEval(`navigator.permissions.query({name:'microphone'}).then(s=>s.state)`)
  srv.close(); return out
}
