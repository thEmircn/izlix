module.exports = async ({ tabs, sleep, shellEval: se }) => {
  const out = {}
  const shellEval = (c) => se(c).catch(() => null)
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  const w = () => tabs.get(id).view.getBounds().width
  const isOpen = () => shellEval(`document.querySelector('.panel-toggle')?.getAttribute('aria-pressed')`)
  if ((await isOpen()) !== 'true') { await shellEval(`document.querySelector('.panel-toggle').click()`); await sleep(700) }
  out.openWidth = w()
  await shellEval(`document.querySelector('.panel-toggle').click()`); await sleep(900)
  out.closedWidth = w()
  out.panelGone = await shellEval(`!document.querySelector('.panel')`)
  await shellEval(`document.querySelector('.panel-toggle').click()`); await sleep(900)
  out.reopenWidth = w()
  // dashboard acikken panel gizlenir, sayfa gorunumu gizli; kapaninca eski duruma doner
  await shellEval(`document.querySelector('.dash-btn').click()`); await sleep(700)
  out.dashPanelGone = await shellEval(`!document.querySelector('.panel') && !!document.querySelector('.dashboard')`)
  await shellEval(`document.querySelector('.dash-btn').click()`); await sleep(900)
  out.afterDashWidth = w()
  out.widerWhenClosed = out.closedWidth > out.openWidth + 200
  out.restored = Math.abs(out.reopenWidth - out.openWidth) <= 2 && Math.abs(out.afterDashWidth - out.openWidth) <= 2
  return out
}
