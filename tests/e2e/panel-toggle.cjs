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
  // konumlar: sol / alt / sag
  const side = async (name) => { await shellEval(`[...document.querySelectorAll('.pctl-b')].find(b=>b.getAttribute('aria-label')==='${name}')?.click()`); await sleep(1000) }
  const b = () => tabs.get(id).view.getBounds()
  const base = b()
  await side('Dock left'); out.left = b(); out.leftPanelBeforePage = out.left.x > base.x + 100
  await side('Dock bottom'); out.bottom = b(); out.bottomShorter = out.bottom.height < base.height - 100 && out.bottom.width > base.width + 100
  await side('Dock right'); out.right = b(); out.rightRestored = Math.abs(out.right.x - base.x) <= 2 && Math.abs(out.right.width - base.width) <= 2
  out.sidePersisted = await shellEval(`localStorage.getItem('panelSide')`)
  out.widerWhenClosed = out.closedWidth > out.openWidth + 200
  out.restored = Math.abs(out.reopenWidth - out.openWidth) <= 2 && Math.abs(out.afterDashWidth - out.openWidth) <= 2
  return out
}
