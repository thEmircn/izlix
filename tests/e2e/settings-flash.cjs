module.exports = async ({ tabs, win, settings, sleep, shellEval, pageEval, click }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  // panel kisayollari
  win.webContents.send('ui:cmd', 'panel.1'); await sleep(400)
  out.tab1 = await shellEval(`document.querySelector('.seg2 button.on')?.textContent`)
  win.webContents.send('ui:cmd', 'panel.3'); await sleep(400)
  out.tab3 = await shellEval(`document.querySelector('.seg2 button.on')?.textContent`)
  win.webContents.send('ui:cmd', 'panel.0'); await sleep(300)
  // ayarlar
  win.webContents.send('ui:cmd', 'settings.open'); await sleep(500)
  out.dialog = await shellEval(`!!document.querySelector('[role=dialog][aria-label=Settings]')`)
  out.before = settings.get().autoOpen
  await shellEval(`[...document.querySelectorAll('.switch')][0].click()`); await sleep(400)
  out.after = settings.get().autoOpen
  await shellEval(`(()=>{const sel=document.querySelector('.dialog select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(sel,'tr');sel.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(500)
  out.lang = settings.get().language
  await shellEval(`(()=>{const sel=document.querySelector('.dialog select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(sel,'en');sel.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(300)
  await shellEval(`document.querySelector('.dialog').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  // React vurgulama
  out.flashOn = await shellEval(`window.izlix.flashRenders(${JSON.stringify(id)}, true)`)
  await pageEval(`window.__seen=0; new MutationObserver(()=>{const l=document.getElementById('__izlix_flash__'); if(l&&l.children.length) window.__seen=Math.max(window.__seen,l.children.length)}).observe(document.documentElement,{childList:true,subtree:true}); 0`)
  await click('#load'); await sleep(900)
  out.boxes = await pageEval(`window.__seen`)
  out.flashOff = await shellEval(`window.izlix.flashRenders(${JSON.stringify(id)}, false)`)
  out.layerGone = await pageEval(`!document.getElementById('__izlix_flash__')`)
  return out
}
