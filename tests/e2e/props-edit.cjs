module.exports = async ({ tabs, sleep, shellEval, pageEval, click }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1200)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Components').click()`); await sleep(1200)
  await shellEval(`[...document.querySelectorAll('[data-testid=tree] > div > div')].find(r=>r.textContent.startsWith('Row')).click()`); await sleep(900)
  out.props = await shellEval(`[...document.querySelectorAll('.hookrow')].map(r=>r.textContent.slice(0,40))`)
  await shellEval(`(()=>{const i=[...document.querySelectorAll('.hookinp')][0];const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'{"id":0,"name":"Props edited"}');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(900)
  out.page = await pageEval(`[...document.querySelectorAll('li')].map(l=>l.textContent)`)
  return out
}
