module.exports = async ({ tabs, sleep, shellEval, bus }) => {
  const out = {}
  const id = await tabs.create({ url: process.env.SITE || 'https://react.dev', workspaceId: 'default' }); await sleep(9000)
  const snap = bus.snapshot(id)
  out.events = snap.length
  out.requests = snap.filter((e) => e.kind === 'request').length
  out.renders = snap.filter((e) => e.kind === 'render').length
  out.errors = snap.filter((e) => e.kind === 'error').length
  out.vitals = [...new Set(snap.filter((e) => e.kind === 'vital').map((e) => e.payload.name))]
  out.title = tabs.get(id).view.webContents.getTitle()
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Network'); await sleep(800)
  out.netRows = await shellEval(`document.querySelectorAll('.net-row').length`)
  out.netStats = await shellEval(`[...document.querySelectorAll('.net-stats .stat')].map(s=>s.innerText.replace(/\\s+/g,' '))`)
  await tab('Components'); await sleep(2500)
  out.compRows = await shellEval(`document.querySelectorAll('[data-testid=tree] > div > div').length`)
  out.compNote = await shellEval(`document.querySelector('.insp-count, .net-bar span')?.textContent`)
  await tab('Meta'); await sleep(1500)
  out.seoScore = await shellEval(`document.querySelector('.seo .vnum')?.innerText.replace(/\\s+/g,'')`)
  await tab('Performance'); await sleep(1500)
  out.cards = await shellEval(`[...document.querySelectorAll('.vcard .vnum')].map(e=>e.innerText.replace(/\\s+/g,''))`)
  await tab('A11y'); await sleep(2500)
  out.a11y = await shellEval(`[...document.querySelectorAll('.a11y .stat b')].map(e=>e.innerText)`)
  return out
}
