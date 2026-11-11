module.exports = async ({ tabs, win, sleep, shellEval, cardState }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(`<title>Kart ${q.url.slice(1)}</title><body style="background:#246;color:#fff"><h1>${q.url}</h1>`) })
  await new Promise((r) => srv.listen(5441, '127.0.0.1', r))
  const a = await tabs.create({ url: 'http://localhost:5441/alfa', workspaceId: 'default' }); await sleep(3500) // onizleme yakalanir (1.5 sn sonra)
  const b = await tabs.create({ url: 'http://localhost:5441/beta', workspaceId: 'default' }); await sleep(1500)
  const before = win.contentView.children.length
  // fare ile sekmenin ustune gel: kart acilir (450 ms gecikme)
  await shellEval(`(()=>{const t=[...document.querySelectorAll('.tab')].find(x=>x.textContent.includes('Kart alfa')); t.dispatchEvent(new MouseEvent('mouseover',{bubbles:true})); t.dispatchEvent(new MouseEvent('mouseenter',{bubbles:false}))})()`); await sleep(1400)
  out.shown = cardState.shown
  out.addedView = win.contentView.children.length === before + 1
  out.hasThumb = cardState.hasImg
  out.title = cardState.title
  out.below = cardState.bounds.y > 20 && cardState.bounds.y < 80 && cardState.bounds.width === 300
  // ayrilinca gizlenir
  await shellEval(`(()=>{const t=[...document.querySelectorAll('.tab')].find(x=>x.textContent.includes('Kart alfa')); t.dispatchEvent(new MouseEvent('mouseout',{bubbles:true})); t.dispatchEvent(new MouseEvent('mouseleave',{bubbles:false}))})()`); await sleep(500)
  out.hidden = !cardState.shown && win.contentView.children.length === before
  // gizli sekme: baslik/adres/onizleme sizmaz
  const p = await tabs.create({ url: 'http://localhost:5441/gizli', workspaceId: 'default', private: 'incognito' }); await sleep(2000)
  await shellEval(`window.izlix.tabCard('${p}', 100, 40)`); await sleep(500)
  out.privateNoThumb = cardState.hasImg === false && cardState.title === 'Private'
  await shellEval(`window.izlix.tabCard(null)`)
  srv.close(); return out
}
