// MVP #3: gomulu DevTools yuklenir; yerlesim (sag/alt) ve sekme basina ayri DevTools
module.exports = async ({ tabs, sleep, shellEval }) => {
  const out = {}
  tabs.setLayout({ dock: 'right', panelRatio: 0.4, chromeHeight: 84 })
  const a = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3500)
  const dt = tabs.get(a).devtools
  out.devtoolsUrl = dt && dt.webContents.getURL().slice(0, 60)
  out.title = dt && dt.webContents.getTitle()
  out.boundsRight = dt && dt.getBounds()
  // DevTools icinden Sources paneli ve sayfanin kaynagi: frontend'e eval
  out.hasSourcesTab = dt && await dt.webContents.executeJavaScript(`document.documentElement.innerHTML.includes('sources') || !!document.querySelector('devtools-tabbed-pane,[aria-label*="Sources"]')`).catch((e) => String(e))
  tabs.setLayout({ dock: 'bottom', panelRatio: 0.4, chromeHeight: 84 }); await sleep(500)
  out.boundsBottom = tabs.get(a).devtools.getBounds()
  const b = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  out.separateDevtools = tabs.get(b).devtools !== tabs.get(a).devtools
  out.aReleased = !tabs.get(a).devtools
  tabs.activate(a); await sleep(3000)
  const dt2 = tabs.get(a).devtools
  out.reopened = dt2 && dt2.webContents.getURL().slice(0, 40)
  out.reopenedBounds = dt2 && dt2.getBounds()
  tabs.activate(b); await sleep(500); tabs.activate(a); await sleep(2500)
  out.reopenedAgain = !!tabs.get(a).devtools && !tabs.get(a).devtools.webContents.isDestroyed()
  return out
}
