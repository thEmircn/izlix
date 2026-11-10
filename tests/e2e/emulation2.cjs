module.exports = async ({ tabs, sleep, pageEval, shellEval: se }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>emu</title>x') })
  await new Promise((r) => srv.listen(5201, '127.0.0.1', r))
  const id = await tabs.create({ url: 'localhost:5201', workspaceId: 'default' }); await sleep(1800)
  const probe = () => pageEval(`({ ua: navigator.userAgent, coarse: matchMedia('(pointer:coarse)').matches, hover: matchMedia('(hover:none)').matches, print: matchMedia('print').matches, contrast: matchMedia('(prefers-contrast: more)').matches, forced: matchMedia('(forced-colors: active)').matches, dark: matchMedia('(prefers-color-scheme: dark)').matches, touchPoints: navigator.maxTouchPoints })`)
  out.base = await probe(); out.base.cleanUa = !/Electron|izlix/.test(out.base.ua)
  await tabs.setEmulation(id, { ua: 'ios-safari' }); await sleep(300)
  out.ios = await probe()
  await tabs.setEmulation(id, { ua: null, touch: true, contrast: 'more', forcedColors: true, print: true }); await sleep(300)
  out.combo = await probe()
  // renk semasi (setMedia) ekstralari ezmemeli
  await tabs.setMedia(id, 'dark', false); await sleep(300)
  out.withDark = await probe()
  await tabs.setEmulation(id, { vision: 'deuteranopia' }); await sleep(300)
  out.visionInfo = tabs.get(id).info.emu.vision
  await tabs.setEmulation(id, { ua: null, touch: null, vision: null, contrast: null, forcedColors: null, print: null }); await tabs.setMedia(id, null, false); await sleep(300)
  out.reset = await probe(); out.emuAfter = tabs.get(id).info.emu === undefined
  srv.close(); return out
}
