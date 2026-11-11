// Kendi Network ve Console panellerimiz: satirlar, ayrinti cekmecesi, yanit govdesi, tekrar sayaci, kayan sekme gostergesi
module.exports = async ({ tabs, sleep, click, shellEval, pageEval }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`console.warn('careful'); console.error('boom'); for(let i=0;i<4;i++) console.log('repeated')`)
  await click('#load'); await sleep(300); await click('#fail'); await sleep(1500)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent.startsWith('${n}')).click()`)
  const ind = () => shellEval(`[...document.querySelectorAll('.rail > button')].findIndex(b=>b.classList.contains('on'))`)
  const i0 = await ind()
  await tab('Network'); await sleep(600)
  out.indicatorMoved = (await ind()) !== i0
  out.rows = await shellEval(`document.querySelectorAll('.net-row').length`)
  out.has500 = await shellEval(`[...document.querySelectorAll('.net-row .pill')].some(p=>p.textContent==='500')`)
  out.errorsStat = await shellEval(`(()=>{const b=document.querySelector('.net-stats .stat:last-child b'); return b.querySelector('.roll')?.getAttribute('aria-label') ?? b.textContent})()`)
  await shellEval(`[...document.querySelectorAll('.net-row')].find(r=>r.querySelector('.pill.server')).click()`); await sleep(600)
  out.drawer = await shellEval(`!!document.querySelector('.drawer')`)
  out.headersShown = await shellEval(`document.querySelector('.drawer-b').innerText.includes('Content-Length')`)
  await shellEval(`[...document.querySelectorAll('.drawer .seg2 button')].find(b=>b.textContent==='Response').click()`); await sleep(800)
  out.body = await shellEval(`document.querySelector('.drawer-b pre, .drawer-b .jtree')?.innerText`)
  await shellEval(`document.querySelector('.drawer .icon-btn').click()`); await sleep(300)
  out.drawerClosed = await shellEval(`!document.querySelector('.drawer')`)
  await shellEval(`[...document.querySelectorAll('.fchip')].find(b=>b.textContent.startsWith('js')).click()`); await sleep(300)
  out.jsRows = await shellEval(`document.querySelectorAll('.net-row').length`); out.jsFiltered = out.jsRows > 0 && out.jsRows < out.rows
  await tab('Console'); await sleep(600)
  out.repeat = await shellEval(`[...document.querySelectorAll('.con-row')].find(r=>r.textContent.includes('repeated'))?.querySelector('.count')?.textContent`)
  out.errorRows = await shellEval(`document.querySelectorAll('.con-row.lv-error').length`)
  return out
}
