module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const out = {}
  await shellEval(`localStorage.setItem('dock','right')`); win.webContents.reload(); await sleep(2000)
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  out.before = { ...tabs.layoutParams }
  const drag = (sel, x, y) => shellEval(`(()=>{const el=document.querySelector('${sel}');const r=el.getBoundingClientRect();el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,clientX:r.x+2,clientY:r.y+2}));window.dispatchEvent(new PointerEvent('pointermove',{clientX:${x},clientY:${y}}));window.dispatchEvent(new PointerEvent('pointerup',{}));return true})()`)
  await drag('.resizer-v', 750, 300); await sleep(500)
  out.afterX = { ...tabs.layoutParams }
  await drag('.resizer-h', 1100, 600); await sleep(500)
  out.afterY = { ...tabs.layoutParams }
  out.stored = await shellEval(`[localStorage.getItem('panelRatio'), localStorage.getItem('split')]`)
  return out
}
