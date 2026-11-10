module.exports = async ({ tabs, sleep, shellEval, pageEval, click, bus }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  // sizinti benzetimi: DOM dugumu eklemeye devam et
  await pageEval(`window.__leak=setInterval(()=>{for(let i=0;i<60;i++){const d=document.createElement('div');d.textContent='x'+i;document.body.appendChild(d)}},250); 0`)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Performance').click()`)
  await sleep(26000)
  out.cards = await shellEval(`[...document.querySelectorAll('.mcard .vname')].map(e=>e.textContent)`)
  out.leak = await shellEval(`!!document.querySelector('.mcard.leak')`)
  out.spark = await shellEval(`document.querySelectorAll('.mcard .spark-line').length`)
  await pageEval(`clearInterval(window.__leak); 0`)
  // replay
  await click('#load'); await sleep(1000)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.net-row')].find(r=>r.textContent.includes('items')).click()`); await sleep(500)
  const before = bus.snapshot(id).filter((e) => e.kind === 'request' && /api\/items/.test(e.payload.url)).length
  await shellEval(`[...document.querySelectorAll('.drawer-h button')].find(b=>b.textContent==='Replay').click()`); await sleep(1200)
  out.replayed = bus.snapshot(id).filter((e) => e.kind === 'request' && /api\/items/.test(e.payload.url)).length - before
  out.toast = await shellEval(`document.querySelector('.toast')?.textContent`)
  return out
}
