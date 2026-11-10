// Sayfa kaynakli file:// gezinmesi ve window.open engellenir; adres cubugu ve http(s) calismaya devam eder
module.exports = async ({ tabs, sleep, pageEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  const n0 = tabs.list().tabs.length
  await pageEval(`window.open('file:///etc/hosts')`); await sleep(800)
  out.fileOpenTabs = tabs.list().tabs.length - n0
  await pageEval(`location.href = 'file:///etc/hosts'`); await sleep(1000)
  out.urlAfterFileNav = tabs.get(id).view.webContents.getURL()
  await pageEval(`window.open('http://localhost:5173/?popup=1')`); await sleep(1500)
  out.httpOpenTabs = tabs.list().tabs.length - n0
  tabs.go(id, 'file:///etc/hosts'); await sleep(1000) // kullanici adres cubugundan yazarsa calisir
  out.userTyped = tabs.get(id).view.webContents.getURL()
  return out
}
