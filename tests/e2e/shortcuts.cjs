module.exports = async ({ tabs, win, sleep, shellEval, settings }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(`<title>kisayol</title>${q.url}`) })
  await new Promise((r) => srv.listen(5541, '127.0.0.1', r))
  await shellEval(`window.izlix.setSettings({ shortcuts: [{ key: 'bul', url: 'http://localhost:5541/ara?q=%s' }] })`); await sleep(400)
  const id = await tabs.create({ workspaceId: 'default' }); await sleep(800)
  tabs.go(id, 'bul kedi resmi'); await sleep(1800)
  out.customUrl = tabs.list().tabs.find((t) => t.id === id).url
  tabs.go(id, 'gh vercel/next.js'); await sleep(5000)
  out.ghDirect = tabs.get(id).view.webContents.getURL()
  // oneri satiri: ilk satir kisayol
  win.webContents.send('ui:cmd', 'addr.focus'); await sleep(300)
  await shellEval(`(()=>{const i=document.querySelector('.addr'); i.dispatchEvent(new FocusEvent('focusin',{bubbles:true})); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'bul merhaba'); i.dispatchEvent(new InputEvent('input',{bubbles:true,inputType:'insertText',data:'x'}))})()`); await sleep(700)
  out.firstRow = await shellEval(`document.querySelector('.sug-row b')?.textContent`)
  // ayar kaydi
  out.stored = settings.get().shortcuts.length
  srv.close(); return out
}
