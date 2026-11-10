module.exports = async ({ tabs, win, sleep, shellEval, click, shot }) => {
  const out = {}
  const a = await tabs.create({ url: 'localhost:5173/?x=1', workspaceId: 'default' }); await sleep(1500)
  const b = await tabs.create({ url: 'localhost:5173/?x=2', workspaceId: 'default' }); await sleep(1500)
  const mine = () => tabs.list().tabs.filter((t) => t.workspaceId === 'default').map((t) => t.url.split('?')[1] || '')
  out.before = mine()
  out.moved = tabs.move(b, 0)
  out.after = mine()
  // surukle-birak (arayuz): HTML5 drag olaylari
  const ev = (which, type) => shellEval(`(()=>{const t=[...document.querySelectorAll('.tab')];const el=${which === 'from' ? 't[t.length-1]' : 't[0]'};const dt=window.__dt||(window.__dt=new DataTransfer());el.dispatchEvent(new DragEvent('${type}',{bubbles:true,cancelable:true,dataTransfer:dt}))})()`)
  await ev('from', 'dragstart'); await sleep(150); await ev('to', 'dragover'); await sleep(150); await ev('to', 'drop'); await ev('from', 'dragend'); await sleep(600)
  out.afterUi = mine()
  // kisayol listesi
  win.webContents.send('ui:cmd', 'shortcuts.open'); await sleep(500)
  out.shortcuts = await shellEval(`document.querySelectorAll('.scrow').length`)
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  // dagilim cubugu
  await click('#load'); await sleep(800)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(600)
  out.breakdown = await shellEval(`document.querySelectorAll('.brkbar i').length`)
  return out
}
