module.exports = async ({ tabs, sleep }) => { await sleep(3000); const l = tabs.list(); return { urls: l.tabs.map((t) => `${t.workspaceId}:${t.url}`), active: l.activeId } }
