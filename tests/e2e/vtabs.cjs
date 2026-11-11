module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(`<title>t${q.url}</title>x`) })
  await new Promise((r) => srv.listen(5341, '127.0.0.1', r))
  const a = await tabs.create({ url: 'http://localhost:5341/a', workspaceId: 'default' }); await sleep(1500)
  await tabs.create({ url: 'http://localhost:5341/b', workspaceId: 'default' }); await sleep(1500)
  const cmd = async (text) => { win.webContents.send('ui:cmd', 'palette.open'); await sleep(400); await shellEval(`(()=>{const i=document.querySelector('.pal-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(text)});i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(300); await shellEval(`document.querySelector('.pal-item')?.click()`); await sleep(900) }
  out.topX = tabs.get(tabs.list().activeId).view.getBounds().x
  out.stripTop = await shellEval(`!!document.querySelector('.tabstrip') && !document.querySelector('.vside')`)
  await cmd('Tabs: vertical sidebar')
  out.sideShown = await shellEval(`!!document.querySelector('.vside') && !document.querySelector('.tabstrip')`)
  out.sideWidth = await shellEval(`Math.round(document.querySelector('.vside').getBoundingClientRect().width)`)
  out.sideTabs = await shellEval(`document.querySelectorAll('.vside .tab').length`)
  const act = () => tabs.get(tabs.list().activeId)
  out.pageShifted = act().view.getBounds().x >= 232
  out.pageInside = act().view.getBounds().x + act().view.getBounds().width <= (await shellEval(`window.innerWidth`))
  // tiklayinca sekme degisir
  await shellEval(`[...document.querySelectorAll('.vside .tab')].find(t=>t.textContent.includes('t/a')).click()`); await sleep(500)
  out.clickActivates = tabs.list().activeId === a
  // daralt
  await shellEval(`document.querySelector('.vcollapse').click()`); await sleep(1200)
  out.collapsedWidth = await shellEval(`Math.round(document.querySelector('.vside').getBoundingClientRect().width)`)
  out.collapsedShift = act().view.getBounds().x >= 56 && act().view.getBounds().x < 100
  await shellEval(`document.querySelector('.vcollapse').click()`); await sleep(500)
  // geri: ustte serit
  await cmd('Tabs: horizontal strip')
  out.backTop = await shellEval(`!!document.querySelector('.tabstrip') && !document.querySelector('.vside')`)
  out.backX = act().view.getBounds().x
  srv.close(); return out
}
