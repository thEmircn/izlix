module.exports = async ({ tabs, win, sleep, shellEval: se, click }) => {
  const out = { errs: [] }
  const shellEval = (c) => se(c).catch((e) => { out.errs.push(c.slice(0, 80)); return null })
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  const first = () => shellEval(`document.querySelector('.pal-item span')?.textContent`)
  const open = async () => { win.webContents.send('ui:cmd', 'palette.open'); await sleep(450) }
  const type = (v) => shellEval(`(()=>{const i=document.querySelector('.pal-input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  const enter = () => shellEval(`document.querySelector('.pal-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))`)
  await open(); out.firstBefore = await first()
  await shellEval(`document.querySelector('.pal-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  // 'Keyboard' komutunu uc kez kullan
  for (let i = 0; i < 3; i++) { await open(); await type('Keyboard Shortcuts'); await sleep(150); await enter(); await sleep(400); await shellEval(`document.querySelector('.dialog')?.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300) }
  await open(); out.firstAfter = await first()
  await shellEval(`document.querySelector('.pal-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  // Timeline arama
  await click('#load'); await sleep(1200)
  const circles = () => shellEval(`document.querySelectorAll('svg circle.node').length`)
  out.all = await circles()
  await shellEval(`(()=>{const i=[...document.querySelectorAll('input.search')].find(x=>x.placeholder==='Search events');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'items');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(400)
  out.filtered = await circles()
  return out
}
