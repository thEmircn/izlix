module.exports = async ({ tabs, sleep, shellEval, click }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Console'); await sleep(500)
  const run = async (expr) => {
    await shellEval(`(()=>{const i=document.querySelector('.repl-bar input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(expr)});i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`)
    await sleep(700)
    return shellEval(`[...document.querySelectorAll('.repl-out')].pop().innerText`)
  }
  out.sum = await run('1 + 2')
  out.title = await run('document.title')
  out.obj = await run('({a: 1, b: "x"})')
  out.err = await run('nope.x')
  out.errClass = await shellEval(`[...document.querySelectorAll('.repl-out')].pop().className`)
  out.awaited = await run('await Promise.resolve(7)')
  // cURL kopyala
  await click('#load'); await sleep(1200)
  await tab('Network'); await sleep(500)
  await shellEval(`window.__clip=null; navigator.clipboard.writeText=(t)=>{window.__clip=t;return Promise.resolve()}; 0`)
  await shellEval(`[...document.querySelectorAll('.net-row')].find(r=>r.textContent.includes('items')).click()`); await sleep(500)
  await shellEval(`[...document.querySelectorAll('.drawer-h button')].find(b=>b.textContent==='cURL').click()`); await sleep(200)
  out.curl = await shellEval(`window.__clip`)
  return out
}
