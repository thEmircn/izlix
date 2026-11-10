// Sekme acip kapatinca surec sayisi taban cizgisine donmeli (DevTools/lab sizintisi yok)
module.exports = async ({ app, tabs, sleep }) => {
  const count = () => app.getAppMetrics().length
  await sleep(2000)
  const first = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  const base = count()
  const ids = []
  for (let i = 0; i < 5; i++) { ids.push(await tabs.create({ url: 'localhost:5173', workspaceId: 'default' })); await sleep(700) }
  const peak = count()
  await tabs.setLab(ids[4], ['laptop', 'iphone-se', 'ipad-mini']); await sleep(2500)
  const labPeak = count()
  for (const id of ids) tabs.close(id)
  await sleep(4000)
  return { base, peak, labPeak, after: count(), tabsLeft: tabs.list().tabs.length, hasDevtools: !!tabs.get(first).devtools }
}
