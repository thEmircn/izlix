module.exports = async ({ tabs, win, sleep, shellEval }) => {
  const out = {}
  const a = await tabs.create({ url: 'localhost:5173/?1', workspaceId: 'default' }); await sleep(1200)
  const b = await tabs.create({ url: 'localhost:5173/?2', workspaceId: 'default' }); await sleep(1200)
  const c = await tabs.create({ url: 'localhost:5173/?3', workspaceId: 'default' }); await sleep(1200)
  const mine = tabs.list().tabs.filter((t) => t.workspaceId === 'default').map((t) => t.id)
  const send = async (cmd) => { win.webContents.send('ui:cmd', cmd); await sleep(500); return tabs.list().activeId }
  out.next = (await send('tab.next')) === mine[0]            // sonuncudan basa sarar
  out.prev = (await send('tab.prev')) === mine[mine.length - 1]
  out.go2 = (await send('tab.go.2')) === mine[1]
  out.last = (await send('tab.go.9')) === mine[mine.length - 1]
  // panel sekmesi kalici
  win.webContents.send('ui:cmd', 'panel.2'); await sleep(300)
  out.persisted = await shellEval(`localStorage.getItem('panelTab')`)
  return out
}
