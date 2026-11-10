// MVP #9 palet, #8 UI rozetleri, #10 rapor
module.exports = async ({ tabs, win, rules, refreshRules, sleep, click, shellEval, shot, exportReport, bus }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  rules.set('default', { rules: [{ id: 'a', name: 'Mock items', enabled: true, urlPattern: '/api/items', action: { type: 'mock', status: 200, body: '[{"id":9,"name":"M"}]', contentType: 'application/json' } }], domains: ['localhost'] })
  refreshRules(); await sleep(400)
  await click('#load'); await sleep(1200)

  // palet
  win.webContents.send('ui:cmd', 'palette.open'); await sleep(400)
  out.paletteOpen = await shellEval(`!!document.querySelector('.pal-input')`)
  out.typeMs = await shellEval(`new Promise(r=>{const i=document.querySelector('.pal-input');const t=performance.now();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'rule');i.dispatchEvent(new Event('input',{bubbles:true}));requestAnimationFrame(()=>requestAnimationFrame(()=>r(Math.round(performance.now()-t))))})`)
  out.items = await shellEval(`[...document.querySelectorAll('.pal-item span:first-child')].map(e=>e.textContent).slice(0,4)`)
  await shot('/private/tmp/e2e-tmp/palette.png')
  await shellEval(`document.querySelector('.pal-input').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  out.paletteClosed = await shellEval(`!document.querySelector('.pal-input')`)

  out.badgeText = await shellEval(`document.querySelector('.rule-badge')?.textContent`)
  win.webContents.send('ui:cmd', 'rules.open'); await sleep(400)
  out.rulesPanel = await shellEval(`document.querySelectorAll('.dialog input[type=checkbox]').length`)
  await shot('/private/tmp/e2e-tmp/rules-panel.png')
  win.webContents.send('ui:cmd', 'palette.open'); await sleep(200)
  await sleep(200)

  // rapor
  tabs.activate(id)
  const file = '/private/tmp/e2e-tmp/report.zip'
  out.report = await exportReport(file)
  out.zip = require('child_process').execFileSync('unzip', ['-Z1', file]).toString().trim().split('\n')
  out.summary = require('child_process').execFileSync('unzip', ['-p', file, 'summary.md']).toString().split('\n').slice(0, 14)
  return out
}
