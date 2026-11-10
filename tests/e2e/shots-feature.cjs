module.exports = async ({ tabs, sleep, shellEval, pageEval, app }) => {
  const fs = require('fs'), out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`document.body.style.minHeight='3000px'; 0`)
  const png = (f) => { const b = fs.readFileSync(f); return { sig: b.slice(1, 4).toString(), w: b.readUInt32BE(16), h: b.readUInt32BE(20) } }
  const v = await shellEval(`window.izlix.screenshot(${JSON.stringify(id)}, 'viewport')`)
  out.viewport = png(v.path)
  const f = await shellEval(`window.izlix.screenshot(${JSON.stringify(id)}, 'full')`)
  out.full = png(f.path)
  out.copy = await shellEval(`window.izlix.screenshot(${JSON.stringify(id)}, 'viewport', {copy:true}).then(r=>({hasB64:!!r.b64, len:r.b64.length}))`)
  // dugum
  await shellEval(`window.izlix.dtEnable(${JSON.stringify(id)}, 'elements')`)
  const doc = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'DOM.getDocument', {depth:-1})`)
  const find = (n, pred) => pred(n) ? n : (n.children || []).map((c) => find(c, pred)).find(Boolean)
  const btn = find(doc.root, (n) => n.attributes && n.attributes.includes('load'))
  const nd = await shellEval(`window.izlix.screenshot(${JSON.stringify(id)}, 'node', {nodeId:${btn.nodeId}})`)
  out.node = png(nd.path)
  out.files = [v.path, f.path, nd.path].every((p) => fs.existsSync(p))
  return out
}
