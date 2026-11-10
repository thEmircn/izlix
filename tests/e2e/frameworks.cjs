module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>vue-ish</title><div id="app" data-v-app>hello</div><script>window.__VUE__ = true; window.Vue = { version: "3.4.2" }</script>') })
  await new Promise((r) => srv.listen(5200, '127.0.0.1', r))
  const react = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  out.reactDetected = await shellEval(`window.izlix.frameworks(${JSON.stringify(react)})`)
  await shellEval(`document.querySelector('.dash-btn').click()`); await sleep(5200)
  out.chips = await shellEval(`[...document.querySelectorAll('.fw-chips .rchip')].map(c=>c.textContent)`)
  await shellEval(`document.querySelector('.dash-btn').click()`); await sleep(400)
  const vue = await tabs.create({ url: 'localhost:5200', workspaceId: 'default' }); await sleep(2000)
  out.vueDetected = await shellEval(`window.izlix.frameworks(${JSON.stringify(vue)})`)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Components')?.click()`); await sleep(1800)
  out.note = await shellEval(`document.querySelector('.fw-note')?.textContent`)
  srv.close(); return out
}
