module.exports = async ({ tabs, workspaces, sleep }) => {
  const w = workspaces.create('Proj', '/tmp/proj-x')
  await tabs.create({ url: 'localhost:5173/?a=1', workspaceId: 'default' }); await sleep(2000)
  await tabs.create({ url: 'localhost:5173/?b=2', workspaceId: w.id }); await sleep(2000)
  return { urls: tabs.list().tabs.map((t) => t.url) }
}
