module.exports = async ({ tabs, win, sleep, click, shellEval, shot, rules, refreshRules }) => {
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  rules.set('default', { rules: [{ id: 'a', name: 'Mock items', enabled: true, urlPattern: '/api/items', action: { type: 'mock', status: 200, body: '[{"id":9}]', contentType: 'application/json' } }, { id: 'b', name: 'Slow', enabled: false, urlPattern: '/api/slow', method: 'GET', action: { type: 'delay', ms: 1500 } }], domains: ['localhost'] }); refreshRules(); await sleep(400)
  await click('#load'); await sleep(1500)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg b')].find(b=>b.textContent.startsWith('${n}')).click()`)
  await tab('Components'); await sleep(900)
  await shellEval(`document.querySelector('[data-testid=tree] > div > div').click()`); await sleep(600)
  await shot('/private/tmp/e2e-tmp/s-comp.png')
  await tab('Renders'); await sleep(500); await shot('/private/tmp/e2e-tmp/s-renders.png')
  win.webContents.send('ui:cmd', 'rules.open'); await sleep(500); await shot('/private/tmp/e2e-tmp/s-rules.png')
  return {}
}
