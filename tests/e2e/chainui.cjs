// Detail panelinde neden zinciri: render olayini sec -> girdiye kadar zincir gorunur
module.exports = async ({ tabs, sleep, click, shellEval, shot }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1800)
  out.clicked = await shellEval(`(()=>{const c=[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='#ffb454').pop(); if(!c) return false; c.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true})()`)
  await sleep(400)
  out.text = await shellEval(`document.body.innerText`)
  out.hasChain = /Cause chain/.test(out.text)
  out.steps = (out.text.match(/\\+\\d+ ms/g) || []).length
  out.kinds = ['input', 'request', 'response', 'render'].map((k) => new RegExp('\\\\n' + k + ' #\\\\d+').test(out.text))
  delete out.text
  await shot('/private/tmp/e2e-tmp/chain.png')
  return out
}
