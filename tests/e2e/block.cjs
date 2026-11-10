module.exports = async ({ tabs, rules, refreshRules, sleep, pageEval, shellEval, bus, click }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  rules.set('default', { rules: [{ id: 'b', name: 'block', enabled: true, urlPattern: '/api/items', action: { type: 'block' } }], domains: ['localhost'] }); refreshRules(); await sleep(400)
  out.blocked = await pageEval(`fetch('/api/items').then(r=>'ok '+r.status).catch(e=>String(e).slice(0,30))`)
  out.otherOk = await pageEval(`fetch('/src/main.tsx').then(r=>'ok '+r.status).catch(e=>'ERR')`)
  const r = bus.snapshot(id).filter((e) => e.kind === 'request' && /api\/items/.test(e.payload.url))[0]
  out.badge = r && r.payload.modified && r.payload.modified.kinds
  // preserve log kapaliyken navigasyondan onceki istekler gizlenir
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(400)
  out.rowsBefore = await shellEval(`document.querySelectorAll('.net-row').length`)
  await shellEval(`[...document.querySelectorAll('label.tgl')].find(l=>l.textContent.includes('Preserve')).querySelector('input').click()`); await sleep(300)
  await tabs.reload(id); await sleep(2500)
  out.rowsAfterReload = await shellEval(`document.querySelectorAll('.net-row').length`)
  return out
}
