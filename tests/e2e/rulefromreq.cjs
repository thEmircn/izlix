module.exports = async ({ tabs, sleep, click, shellEval, rules, pageEval }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1500)
  await shellEval(`[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='var(--ln-request)').pop().dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(300)
  await shellEval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='fail 500').click()`); await sleep(600)
  const cfg = rules.get('default')
  out.rule = cfg.rules[0] && { kind: cfg.rules[0].action.type, code: cfg.rules[0].action.code, pattern: cfg.rules[0].urlPattern, method: cfg.rules[0].method }
  out.panelOpen = await shellEval(`!!document.querySelector('[role=dialog][aria-label^="Request Rules"]')`)
  await shellEval(`document.querySelector('[role=dialog][aria-label^="Request Rules"]').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  out.afterStatus = await pageEval(`fetch('/api/items').then(r=>r.status)`)
  // mock: gercek govdeyle dolar
  rules.set('default', { rules: [], domains: ['localhost'] })
  await shellEval(`window.izlix.setRules('default',{rules:[],domains:['localhost']})`); await sleep(300)
  await click('#load'); await sleep(1500)
  await shellEval(`[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='var(--ln-request)').pop().dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(300)
  await shellEval(`[...document.querySelectorAll('button')].find(b=>b.textContent==='mock').click()`); await sleep(800)
  const m = rules.get('default').rules[0]
  out.mockBody = m && m.action.body && m.action.body.slice(0, 60)
  return out
}
