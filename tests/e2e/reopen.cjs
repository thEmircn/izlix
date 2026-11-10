module.exports = async ({ tabs, sleep, shellEval }) => {
  const a = await tabs.create({ url: 'localhost:5173/?r=1', workspaceId: 'default' }); await sleep(2500)
  tabs.close(a); await sleep(300)
  const n0 = tabs.list().tabs.length
  const id = await shellEval(`window.izlix.reopenTab()`); await sleep(2000)
  return { reopened: !!id, delta: tabs.list().tabs.length - n0, url: tabs.get(id).info.url, none: await shellEval(`window.izlix.reopenTab()`).then((x) => x !== null ? 'more' : 'empty') }
}
