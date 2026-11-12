// README ekran goruntuleri (docs/screenshots): demo -> nedensellik zinciri -> palet -> Uygulama Merkezi
module.exports = async ({ tabs, win, sleep, click, shellEval, shot }) => {
  const dir = process.env.DB_SHOT_DIR
  await sleep(1200)
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Allow').click()`); await sleep(300)
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Open the demo').click()`); await sleep(3500)
  // kisa demo GIF'i icin kareler: tikla -> istek -> yanit -> render zinciri
  const fs = require('fs'); const fdir = dir + '/frames'; fs.mkdirSync(fdir, { recursive: true })
  await shot(fdir + '/f00.png')
  await click('#load')
  for (let i = 1; i <= 16; i++) { await sleep(170); await shot(fdir + '/f' + String(i).padStart(2, '0') + '.png') }
  await sleep(600)
  await shellEval(`[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='var(--ln-render)').pop()?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(500)
  await shot(dir + '/timeline.png')
  win.webContents.send('ui:cmd', 'palette.open'); await sleep(600)
  await shot(dir + '/palette.png')
  await shellEval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  win.webContents.send('ui:cmd', 'svch.open'); await sleep(700)
  await shot(dir + '/hub.png')
  return {}
}
