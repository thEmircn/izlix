module.exports = async ({ tabs, sleep, shellEval, pageEval, lastSpeak, ctxPrepare }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end('<html lang="tr"><title>oku</title><body><nav>MENU</nav><article><p id="p1">Birinci paragraf burada.</p><p>Ikinci paragraf da burada.</p></article></body>') })
  await new Promise((r) => srv.listen(5581, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5581/', workspaceId: 'default' }); await sleep(1800)
  // secili metin
  await pageEval(`(()=>{const r=document.createRange(); r.selectNodeContents(document.getElementById('p1')); const s=getSelection(); s.removeAllRanges(); s.addRange(r)})()`)
  out.selOk = await shellEval(`window.izlix.speak('auto')`)
  out.selText = lastSpeak().text; out.selLang = lastSpeak().lang
  // secim yok: sayfanin makale metni (menu yok)
  await pageEval(`getSelection().removeAllRanges()`)
  out.pageOk = await shellEval(`window.izlix.speak('auto')`)
  out.pageText = lastSpeak().text
  out.selectionOnlyEmpty = await shellEval(`window.izlix.speak('selection')`)
  out.stopFalse = await shellEval(`window.izlix.speak('stop')`)
  // sag tik menusu: secili metinde "sesli oku"
  const p = await ctxPrepare(id, { x: 30, y: 30, selectionText: 'merhaba' })
  out.ctxSel = p.items.some((i) => i.act === 'speakSel')
  const q = await ctxPrepare(id, { x: 30, y: 30 })
  out.ctxPage = q.items.some((i) => i.act === 'speakPage')
  srv.close(); return out
}
