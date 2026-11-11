module.exports = async ({ tabs, sleep, settings, pageEval }) => {
  const http = require('http'), out = {}
  const html = `<title>c</title><body style="overflow:hidden"><p>icerik</p>
    <div id="onetrust-banner-sdk" style="position:fixed;bottom:0;height:80px"><button id="onetrust-reject-all-handler" onclick="window.__rej=(window.__rej||0)+1">Reject All</button><button id="onetrust-accept-btn-handler" onclick="window.__acc=1">Accept</button></div>
    <div class="my-consent-box" style="position:fixed;top:0;height:60px"><button id="gen" onclick="window.__gen=1">Sadece gerekli çerezler</button><button onclick="window.__acc2=1">Tümünü kabul et</button></div>
    <div id="CybotCookiebotDialog" style="height:50px">x</div></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(html) })
  await new Promise((r) => srv.listen(5311, '127.0.0.1', r))
  settings.set({ cookieBanners: true, adblockDev: true })
  await tabs.create({ url: 'http://localhost:5311/', workspaceId: 'default' }); await sleep(3000)
  out.rejected = await pageEval(`window.__rej || 0`)
  out.neverAccepts = await pageEval(`!window.__acc && !window.__acc2`)
  out.generic = await pageEval(`window.__gen || 0`)
  out.cssHides = await pageEval(`getComputedStyle(document.getElementById('CybotCookiebotDialog')).display`)
  out.scrollUnlocked = await pageEval(`getComputedStyle(document.body).overflow`)
  settings.set({ cookieBanners: false })
  await tabs.create({ url: 'http://localhost:5311/', workspaceId: 'default' }); await sleep(2500)
  out.offUntouched = await pageEval(`(window.__rej || 0) === 0 && getComputedStyle(document.getElementById('CybotCookiebotDialog')).display !== 'none'`)
  settings.set({ adblockDev: false })
  srv.close(); return out
}
