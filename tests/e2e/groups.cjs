module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(`<title>t${q.url}</title>x`) })
  await new Promise((r) => srv.listen(5411, '127.0.0.1', r))
  const ids = []
  for (const p of ['a', 'b', 'c', 'd']) { ids.push(await tabs.create({ url: 'http://localhost:5411/' + p, workspaceId: 'default' })); await sleep(900) }
  const [a, b, c, d] = ids
  const order = () => tabs.list().tabs.map((t) => t.id)
  // A'yi yeni gruba ekle, D'yi de ayni gruba: bitisik olmali (a d b c)
  out.created = await shellEval(`window.izlix.setTabGroup('${a}', 'new')`); await sleep(300)
  const gid = tabs.list().tabs.find((t) => t.id === a).group
  await shellEval(`window.izlix.setTabGroup('${d}', '${gid}')`); await sleep(300)
  const o = order(); const ia = o.indexOf(a), id_ = o.indexOf(d)
  out.contiguous = Math.abs(ia - id_) === 1
  out.groupCount = tabs.list().groups.length
  out.chip = await shellEval(`document.querySelectorAll('.gchip').length`)
  out.groupedTabs = await shellEval(`document.querySelectorAll('.tab.grouped').length`)
  // adlandir + renk
  await shellEval(`window.izlix.updateGroup('${gid}', { name: 'Is', color: 'green' })`); await sleep(400)
  out.chipText = await shellEval(`document.querySelector('.gchip')?.textContent`)
  out.chipColor = await shellEval(`getComputedStyle(document.querySelector('.gchip')).getPropertyValue('--gc').trim()`)
  // daralt: aktif olmayan grup sekmeleri gizlenir
  tabs.activate(b); await sleep(300)
  await shellEval(`window.izlix.updateGroup('${gid}', { collapsed: true })`); await sleep(500)
  out.collapsedTabs = await shellEval(`document.querySelectorAll('.tab.grouped').length`)
  out.collapsedCount = await shellEval(`document.querySelector('.gchip em')?.textContent`)
  await shellEval(`document.querySelector('.gchip').click()`); await sleep(500) // tikla: ac
  out.reopened = await shellEval(`document.querySelectorAll('.tab.grouped').length`)
  // sekmeyi gruptan cikar; son sekme cikinca grup silinir
  await shellEval(`window.izlix.setTabGroup('${a}', null)`); await sleep(300)
  out.stillGroup = tabs.list().groups.length
  await shellEval(`window.izlix.setTabGroup('${d}', null)`); await sleep(300)
  out.groupGone = tabs.list().groups.length === 0 && (await shellEval(`document.querySelectorAll('.gchip').length`)) === 0
  // kapatinca bos grup temizlenir
  await shellEval(`window.izlix.setTabGroup('${b}', 'new')`); await sleep(300)
  tabs.close(b); await sleep(400)
  out.closedClean = tabs.list().groups.length === 0
  srv.close(); return out
}
