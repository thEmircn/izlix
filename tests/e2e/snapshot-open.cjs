module.exports = async ({ tabs, win, sleep, shellEval, click, bus }) => {
  const fs = require('fs'), out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1200)
  const file = await shellEval(`window.izlix.saveSnapshot(${JSON.stringify(id)})`)
  process.env.DB_SNAPSHOT_FILE = file
  const liveReq = bus.snapshot(id).filter((e) => e.kind === 'request').length
  // canli olaylari degistir: yeni sekmeye gec -> snapshot yine eski veriyi gostermeli
  const other = await tabs.create({ url: 'about:blank', workspaceId: 'default' }); await sleep(800)
  win.webContents.send('ui:cmd', 'palette.open'); await sleep(500)
  await shellEval(`(()=>{const i=document.querySelector('.pal-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'Open snapshot');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(300)
  await shellEval(`document.querySelector('.pal-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`); await sleep(900)
  out.banner = await shellEval(`document.querySelector('.snapbar span')?.textContent.slice(0,40)`)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(700)
  out.snapRows = await shellEval(`document.querySelectorAll('.net-row').length`)
  out.liveReq = liveReq
  await shellEval(`document.querySelector('.snapbar button').click()`); await sleep(500)
  out.closed = await shellEval(`!document.querySelector('.snapbar')`)
  out.liveRows = await shellEval(`document.querySelectorAll('.net-row').length`)
  return out
}
