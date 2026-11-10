module.exports = async ({ tabs, workspaces, sleep, shellEval, pageEval, rules }) => {
  const out = {}
  const w = workspaces.create('Temp', '/tmp/ws-temp')
  await tabs.create({ url: 'localhost:5173', workspaceId: w.id }); await sleep(2500)
  await pageEval(`document.cookie='k=v; path=/; max-age=3600'`)
  rules.set(w.id, { rules: [{ id: 'r', name: 'r', enabled: true, urlPattern: '/x', action: { type: 'delay', ms: 1 } }], domains: ['localhost'] })
  out.renamed = await shellEval(`window.izlix.renameWorkspace(${JSON.stringify(w.id)}, 'Renamed')`)
  out.name = workspaces.get(w.id).name
  out.deleted = await shellEval(`window.izlix.deleteWorkspace(${JSON.stringify(w.id)})`)
  await sleep(500)
  out.gone = !workspaces.get(w.id)
  out.tabsOfDeleted = tabs.list().tabs.filter((t) => t.workspaceId === w.id).length
  out.rulesGone = rules.get(w.id).rules.length === 0
  out.defaultDeletable = await shellEval(`window.izlix.deleteWorkspace('default')`)
  // ayni kimlikle yeniden olusturulan bolum bos olmali (cerez silindi)
  const again = workspaces.create('Temp2', '/tmp/ws-temp2')
  await tabs.create({ url: 'localhost:5173', workspaceId: again.id }); await sleep(2000)
  out.cookieFresh = await pageEval('document.cookie')
  return out
}
