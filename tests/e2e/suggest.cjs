module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>Zeta Portal</title>zeta') })
  await new Promise((r) => srv.listen(5231, '127.0.0.1', r))
  await tabs.create({ url: 'http://localhost:5231/', workspaceId: 'default' }); await sleep(2500)
  await tabs.create({ workspaceId: 'default' }); await sleep(1200) // yeni sekme: baslangic sayfasi
  const type = (sel, v) => shellEval(`(()=>{const i=document.querySelector('${sel}'); i.focus(); i.dispatchEvent(new FocusEvent('focusin',{bubbles:true})); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'${v}'); i.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'x'})); return 1})()`)
  const key = (sel, k) => shellEval(`document.querySelector('${sel}').dispatchEvent(new KeyboardEvent('keydown',{key:'${k}',bubbles:true,cancelable:true}))`)
  // adres cubugu: satir ici tamamlama
  await type('.addr', 'local'); await sleep(500)
  out.inline = await shellEval(`document.querySelector('.addr').value`)
  out.inlineSel = await shellEval(`(()=>{const i=document.querySelector('.addr'); return i.selectionStart+'-'+i.selectionEnd})()`)
  // oneri listesi: baslik eslesmesi
  await type('.addr', 'zeta'); await sleep(600)
  out.rows = await shellEval(`[...document.querySelectorAll('.sug-row')].map(r=>r.textContent).join('|')`)
  out.listOpen = await shellEval(`!!document.querySelector('.sug')`)
  await key('.addr', 'ArrowDown'); await sleep(200)
  out.selectedIdx = await shellEval(`[...document.querySelectorAll('.sug-row')].findIndex(r=>r.classList.contains('on'))`)
  await key('.addr', 'Enter'); await sleep(1500)
  out.navigated = tabs.active().info.url.includes(':5231')
  out.listClosed = await shellEval(`!document.querySelector('.sug')`)
  // yeni sekme sayfasindaki kutu
  await tabs.create({ workspaceId: 'default' }); await sleep(1200)
  await type('.hub-filter input', 'zeta'); await sleep(600)
  out.startRows = await shellEval(`[...document.querySelectorAll('.sug-row')].length`)
  // Escape listeyi kapatir
  await key('.hub-filter input', 'Escape'); await sleep(300)
  out.startClosed = await shellEval(`!document.querySelector('.sug')`)
  // hic gitmedigin populer siteler: tamamlama + liste
  await type('.addr', 'yout'); await sleep(500)
  out.popInline = await shellEval(`document.querySelector('.addr').value`)
  await type('.addr', 'trendy'); await sleep(600)
  out.popRows = await shellEval(`[...document.querySelectorAll('.sug-row')].map(r=>r.textContent).join('|')`)
  // canli oneri uc noktasi: ag yoksa bos dizi doner, hata firlatmaz
  out.remoteIsArray = await shellEval(`window.izlix.suggestRemote('react').then(Array.isArray)`)
  srv.close(); return out
}
