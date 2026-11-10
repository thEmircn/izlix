module.exports = async ({ tabs, win, sleep, click, shellEval, shot, bus }) => {
  await sleep(1200)
  await shot('/private/tmp/e2e-tmp/ui-welcome.png')
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>/Open the demo/.test(b.textContent)).click()`); await sleep(3500)
  await click('#load'); await sleep(1500)
  await shellEval(`[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='#ffb454').pop().dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(400)
  await shot('/private/tmp/e2e-tmp/ui-main.png')
  win.webContents.send('ui:cmd', 'palette.open'); await sleep(500)
  await shot('/private/tmp/e2e-tmp/ui-palette.png')
  return {}
}
