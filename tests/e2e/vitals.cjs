module.exports = async ({ tabs, sleep, shellEval, pageEval, bus }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3500)
  await pageEval(`(()=>{const e=performance.now();while(performance.now()-e<180);})(); 0`) // uzun gorev
  await sleep(600)
  const names = bus.snapshot(id).filter((e) => e.kind === 'vital').map((e) => e.payload.name)
  out.names = [...new Set(names)]
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Performance').click()`); await sleep(1200)
  out.cards = await shellEval(`[...document.querySelectorAll('.vcard .vname')].map(e=>e.textContent)`)
  out.tbt = await shellEval(`(()=>{const b=document.querySelector('.net-stats .stat b'); return b.querySelector('.roll')?.getAttribute('aria-label') ?? b.textContent})()`)
  out.tasks = await shellEval(`document.querySelectorAll('.task').length`)
  return out
}
