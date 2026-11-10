module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  win.webContents.send('ui:cmd', 'find.open'); await sleep(400)
  out.barOpen = await shellEval(`!!document.querySelector('input[placeholder="Find in page"]')`)
  await shellEval(`window.izlix.findStart(${JSON.stringify(id)}, 'Test', true, false)`); await sleep(800)
  out.counter = await shellEval(`document.querySelector('input[placeholder="Find in page"]') ? document.body.innerText.match(/\\d+\\/\\d+/)?.[0] : null`)
  await shellEval(`document.querySelector('input[placeholder="Find in page"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  out.barClosed = await shellEval(`!document.querySelector('input[placeholder="Find in page"]')`)
  return out
}
