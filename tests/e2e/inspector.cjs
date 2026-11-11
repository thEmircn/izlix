// MVP #4: Inspector agaci, props/state/hooks, Render Tracker, 2000 bilesende kaydirma
module.exports = async (ctx) => { try { return await main(ctx) } catch (e) { return { fail: String(e.stack || e).slice(0, 600) } } }
async function main(ctx) {
  const { tabs, win, sleep, click, pageEval, shot } = ctx
  const shellEval = (c) => ctx.shellEval(`(()=>{try{return ${c}}catch(e){return 'ERR '+e}})()`).catch((e) => 'REJ ' + e)
  const out = {}
  await tabs.create({ url: process.env.DB_URL || 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  out.dbg = await pageEval(`[document.title, [...document.querySelectorAll('button')].map(b=>b.id)]`); if (!out.dbg[1].includes('load')) return out
  await click('#load'); await sleep(500); await click('#load'); await sleep(600)
  const tree = await win.webContents.executeJavaScript(`window.izlix.inspectTree(${JSON.stringify(tabs.list().activeId)}).catch(e=>({err:String(e)}))`)
  if (tree.err) return tree
  out.nodes = tree && tree.nodes.length; out.first = tree && tree.nodes.slice(0, 4).map((n) => `${n.depth}:${n.name}`)
  const app = tree.nodes.find((n) => n.name === 'App')
  const d = app && await win.webContents.executeJavaScript(`window.izlix.inspectNode(${JSON.stringify(tabs.list().activeId)}, ${app.id}, ${app.t}, 'App').catch(e=>({err:String(e)}))`)
  out.detail = d && { name: d.name, hooks: d.hooks && d.hooks.map((h) => `${h.kind}=${JSON.stringify(h.value)}`).slice(0, 6), source: d.source && d.source.file.split('/').slice(-2).join('/') + ':' + d.source.line }
  // arayuz: Components sekmesi
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Components').click()`); await sleep(900)
  out.rows = await shellEval(`document.querySelectorAll('[data-testid=tree] > div > div').length`)
  await shot(require('os').tmpdir() + '/izlix-e2e-inspector.png')
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Renders').click()`); await sleep(500)
  out.tracker = await shellEval(`[...document.querySelectorAll('tbody tr')].slice(0,4).map(r=>r.textContent)`)
  await shot(require('os').tmpdir() + '/izlix-e2e-tracker.png')
  return out
}
