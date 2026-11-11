// HTTPS-only (ag gerekir; ag yoksa karsilastirmalar atlanir): https'e yukseltme ve https olmayan sitede http'ye dusme
module.exports = async ({ tabs, sleep, settings }) => {
  const out = {}
  settings.set({ httpsOnly: true })
  const a = await tabs.create({ url: 'http://example.com/', workspaceId: 'default' }); await sleep(6000)
  const ua = tabs.list().tabs.find((t) => t.id === a).url
  out.online = ua.startsWith('https://') || ua.startsWith('http://')
  out.upgraded = !out.online || ua.startsWith('https://example.com')
  const b = await tabs.create({ url: 'http://httpforever.com/', workspaceId: 'default' }); await sleep(9000)
  const ub = tabs.list().tabs.find((t) => t.id === b).url
  out.fellBack = !out.online || ub.startsWith('http://httpforever.com')
  out.noUpgradeRemembered = !out.online || tabs.get(b).noUpgrade?.has('httpforever.com') === true
  settings.set({ httpsOnly: false })
  const c = await tabs.create({ url: 'http://httpforever.com/', workspaceId: 'default' }); await sleep(4000)
  out.offStaysHttp = !out.online || tabs.list().tabs.find((t) => t.id === c).url.startsWith('http://httpforever.com')
  settings.set({ httpsOnly: true })
  return out
}
