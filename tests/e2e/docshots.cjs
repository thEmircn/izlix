// README ekran goruntuleri (docs/screenshots): demo -> nedensellik zinciri -> palet -> Uygulama Merkezi
module.exports = async ({ tabs, win, sleep, click, shellEval, shot }) => {
  const dir = process.env.DB_SHOT_DIR
  await sleep(1200)
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Allow').click()`); await sleep(300)
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Open the demo').click()`); await sleep(3500)
  await click('#load'); await sleep(1500)
  await shellEval(`[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='#ffb454').pop()?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(500)
  await shot(dir + '/timeline.png')
  win.webContents.send('ui:cmd', 'palette.open'); await sleep(600)
  await shot(dir + '/palette.png')
  await shellEval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  win.webContents.send('ui:cmd', 'svch.open'); await sleep(700)
  await shot(dir + '/hub.png')
  return {}
}
