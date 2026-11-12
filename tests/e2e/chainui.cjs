// Detail panelinde neden zinciri: render olayini sec -> girdiye kadar zincir gorunur
module.exports = async ({ tabs, sleep, click, shellEval, shot }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1800)
  out.clicked = await shellEval(`(()=>{const c=[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='var(--ln-render)').pop(); if(!c) return false; c.dispatchEvent(new MouseEvent('click',{bubbles:true})); return true})()`)
  await sleep(400)
  out.text = await shellEval(`document.body.innerText`)
  out.hasChain = /Cause chain/.test(out.text)
  out.hasInput = /input #\d+ click/.test(out.text); out.hasRequest = /request #\d+ GET/.test(out.text); out.hasResponse = /response #\d+ 200/.test(out.text)
  delete out.text
  await shot(require('os').tmpdir() + '/izlix-e2e-chain.png')
  return out
}
