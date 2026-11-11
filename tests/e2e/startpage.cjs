module.exports = async ({ tabs, sleep, shellEval: se, pageEval }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>hedef</title>merhaba') })
  await new Promise((r) => srv.listen(5203, '127.0.0.1', r))
  await sleep(1500)
  // acilis sekmesi bos: baslangic sayfasi gorunur, ogeler var
  out.startVisible = await shellEval(`!!document.querySelector('.start')`)
  out.hasSearch = await shellEval(`!!document.querySelector('.hub-filter input')`)
  out.sidebar = await shellEval(`[...document.querySelectorAll('.hub-nav button')].map(b=>b.textContent.replace(/\\d+$/,''))`)
  out.navSwitch = await shellEval(`(()=>{[...document.querySelectorAll('.hub-nav button')].find(b=>b.textContent.startsWith('Sessions')).click(); return 1})()`); await sleep(500)
  out.sessionsTitle = await shellEval(`document.querySelector('.hub-head h2')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.hub-nav button')].find(b=>b.textContent.startsWith('Home')).click()`); await sleep(400)
  // arama kutusuna adres yaz + Enter -> ayni sekmede gezinir, baslangic sayfasi kapanir
  await shellEval(`(()=>{const i=document.querySelector('.hub-filter input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'localhost:5203');i.dispatchEvent(new Event('input',{bubbles:true}));i.closest('form').requestSubmit()})()`); await sleep(2500)
  out.navigated = tabs.active().info.url.includes(':5203')
  out.startGone = await shellEval(`!document.querySelector('.start')`)
  out.pageTitle = tabs.active().info.title
  // yeni sekme -> tekrar baslangic sayfasi
  await shellEval(`document.querySelector('.newtab').click()`); await sleep(1200)
  out.startAgain = await shellEval(`!!document.querySelector('.start')`)
  // uygulama hissi: ok imleci, secilemeyen arayuz, secilebilir icerik, kabuk yakinlastirma kilidi
  out.cursorBtn = await shellEval(`getComputedStyle(document.querySelector('.tb-btn')).cursor`)
  out.cursorInput = await shellEval(`getComputedStyle(document.querySelector('.hub-filter input')).cursor`)
  out.userSelectUi = await shellEval(`getComputedStyle(document.querySelector('.tab')).userSelect`)
  out.userSelectInput = await shellEval(`getComputedStyle(document.querySelector('.hub-filter input')).userSelect`)
  out.overscroll = await shellEval(`getComputedStyle(document.body).overscrollBehaviorY`)
  // gecmis satirinin ustune gelince onizleme kutusu acilir
  await shellEval(`[...document.querySelectorAll('.hub-nav button')].find(b=>b.textContent.startsWith('History'))?.click()`); await sleep(500)
  await shellEval(`(()=>{const r=document.querySelector('.hub-row'); if(r) r.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}))})()`); await sleep(900)
  out.popShown = await shellEval(`!!document.querySelector('.hub-pop')`)
  await shellEval(`(()=>{const r=document.querySelector('.hub-row'); if(r) r.dispatchEvent(new MouseEvent('mouseout',{bubbles:true}))})()`); await sleep(300)
  out.popHidden = await shellEval(`!document.querySelector('.hub-pop')`)
  // gizli / Tor dugmeleri
  out.privButtons = await shellEval(`document.querySelectorAll('.hub-priv button').length`)
  const before = tabs.list().tabs.length
  await shellEval(`document.querySelector('.hub-priv button')?.click()`); await sleep(1200)
  out.privTabOpened = tabs.list().tabs.length === before + 1 && tabs.list().tabs.some((t) => t.private === 'incognito')
  srv.close(); return out
}
