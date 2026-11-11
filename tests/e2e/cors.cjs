module.exports = async ({ tabs, rules, refreshRules, sleep, pageEval }) => {
  const fs = require('fs'); const out = {}; const save = (k) => fs.writeFileSync(require('os').tmpdir() + '/izlix-e2e-cors-progress.json', JSON.stringify({ at: k, out }))
  if (process.env.NODT) tabs.setLayout({ dock: 'off', panelRatio: 0.4, chromeHeight: 84 })
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  rules.set('default', { rules: [{ id: 'x', name: 'x', enabled: true, urlPattern: '/api/items', action: { type: 'mock', status: 201, body: '{"ok":true}', contentType: 'application/json' } }], domains: ['localhost'] })
  refreshRules(); await sleep(300)
  const f = (init, u='/api/items') => pageEval(`fetch(${JSON.stringify(u)},${JSON.stringify(init)}).then(async r=>({status:r.status,body:await r.text()})).catch(e=>({error:String(e)}))`)
  save('postNoBody'); out.postNoBody = await f({ method: 'POST' })
  save('postBody'); out.postBody = await f({ method: 'POST', body: 'x' })
  save('crossLocalPostNoBody'); out.cl1 = await f({ method: 'POST', headers: {'content-type':'text/plain'}, body: 'x' }, 'http://127.0.0.1:5173/api/items')
  save('crossPreflight'); out.cl2 = await f({ method: 'POST', headers: {'content-type':'application/json'}, body: '{}' }, 'http://127.0.0.1:5173/api/items')
  save('done')
  return out
}
