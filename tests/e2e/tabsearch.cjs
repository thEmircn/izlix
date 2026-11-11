module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const pages = { '/a': 'Elma agaci pembe cicek acar. pembe renk guzeldir.', '/b': 'Armut sari olur, pembe degil.', '/c': 'Hic ilgisi yok: kiraz ve visne.' }
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(`<title>Sayfa ${q.url.slice(1).toUpperCase()}</title><body>${pages[q.url] || 'x'}</body>`) })
  await new Promise((r) => srv.listen(5551, '127.0.0.1', r))
  const ids = []; for (const p of ['/a', '/b', '/c']) { ids.push(await tabs.create({ url: 'http://localhost:5551' + p, workspaceId: 'default' })); await sleep(1200) }
  const [a, b, c] = ids
  const find = (q) => shellEval(`window.izlix.tabsSearch(${JSON.stringify(q)}).then(l => l.map(h => h.id + ':' + h.count))`)
  const r = await find('PEMBE')
  out.contentHits = r.filter((x) => !x.endsWith(':0'))
  out.countA = r.find((x) => x.startsWith(a + ':'))
  out.noC = !r.some((x) => x.startsWith(c + ':'))
  out.titleOnly = (await find('sayfa c')).includes(c + ':0')
  out.emptyAll = (await find('')).length >= 3
  // uyuyan sekme icerikte aranmaz ama basliktan bulunur
  tabs.activate(c); await sleep(400); tabs.sleep(a); await sleep(500)
  out.sleepingByTitle = (await find('sayfa a')).some((x) => x.startsWith(a + ':0'))
  out.sleepingNoContent = !(await find('agaci')).some((x) => x.startsWith(a + ':'))
  // arayuz: acilir, sonuc satirlari ve ozet gorunur
  win.webContents.send('ui:cmd', 'tabsearch.open'); await sleep(800)
  await shellEval(`(()=>{const i=document.querySelector('.dialog.ts input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'pembe');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(1500)
  out.rows = await shellEval(`document.querySelectorAll('.ts-row').length`)
  out.snippet = await shellEval(`document.querySelector('.ts-row p')?.textContent || ''`)
  out.badge = await shellEval(`document.querySelector('.ts-n')?.textContent`)
  // Enter: ilk sonucun sekmesi aktif olur
  await shellEval(`document.querySelector('.dialog.ts').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`); await sleep(900)
  out.activated = tabs.list().activeId === b || tabs.list().activeId === a
  srv.close(); return out
}
