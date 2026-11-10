module.exports = async ({ tabs, sleep, shellEval, pageEval, click }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1200)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Components'); await sleep(1200)
  await shellEval(`[...document.querySelectorAll('[data-testid=tree] > div > div')].find(r=>r.textContent.startsWith('App')).click()`); await sleep(900)
  out.inputs = await shellEval(`[...document.querySelectorAll('.hookinp')].map(i=>i.value.slice(0,30))`)
  // items hook: dizi olan
  await shellEval(`(()=>{const i=[...document.querySelectorAll('.hookinp')].find(x=>x.value.startsWith('['));const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'[{"id":7,"name":"Edited live"}]');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(900)
  out.page = await pageEval(`[...document.querySelectorAll('li')].map(l=>l.textContent)`)
  // gecersiz JSON
  await shellEval(`(()=>{const i=[...document.querySelectorAll('.hookinp')][0];const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(i,'{bad');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(400)
  out.toast = await shellEval(`document.querySelector('.toast')?.textContent`)
  // pick: #load dugumunden bilesen indeksi
  await shellEval(`window.izlix.dtEnable(${JSON.stringify(id)}, 'elements')`)
  const doc = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'DOM.getDocument', {depth:0})`)
  const q = await shellEval(`window.izlix.dt(${JSON.stringify(id)}, 'DOM.querySelector', {nodeId:${doc.root.nodeId}, selector:'#load'})`)
  out.hit = await shellEval(`window.izlix.dtReactIndex(${JSON.stringify(id)}, ${q.nodeId})`)
  return out
}
