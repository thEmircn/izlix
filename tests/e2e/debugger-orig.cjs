module.exports = async ({ tabs, sleep, shellEval: se, pageEval, click }) => {
  const out = { errs: [] }
  const shellEval = (c) => se(c).catch((e) => { out.errs.push(c.slice(0, 90)); return null })
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3500)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Sources'); await sleep(1200)
  await shellEval(`[...document.querySelectorAll('.srclist > div > .srcitem')].find(e=>e.textContent.startsWith('App.tsx')).click()`); await sleep(1800)
  out.file = await shellEval(`document.querySelector('.codebar b')?.textContent`)
  // orijinal TSX'te fetch satirina kesme noktasi
  const line = await shellEval(`(()=>{const r=[...document.querySelectorAll('.cl')].find(c=>c.innerText.includes("fetch('/api/items')"));if(!r)return null;r.querySelector('.ln').click();return r.querySelector('.ln').textContent})()`)
  out.bpLine = line; await sleep(800)
  out.bpMarked = await shellEval(`!!document.querySelector('.ln.bp')`)
  await click('#load'); await sleep(2000)
  out.paused = await shellEval(`document.querySelector('.pausedbadge')?.textContent`)
  out.pausedText = await shellEval(`document.querySelector('.cl.pausedline')?.innerText.replace(/\\s+/g,' ')`)
  out.frame0 = await shellEval(`(()=>{[...document.querySelectorAll('.dbgpanel .seg2 button')].find(b=>b.textContent.startsWith('Call stack')).click(); return null})()`)
  await sleep(300)
  out.frameText = await shellEval(`document.querySelector('.frame')?.innerText.replace(/\\s+/g,' ')`)
  await shellEval(`[...document.querySelectorAll('.dbgbar .btn')].find(b=>b.textContent==='Resume').click()`); await sleep(1500)
  out.loaded = await pageEval(`document.querySelectorAll('li').length`)
  // hatada duraklat
  await shellEval(`(()=>{const s=document.querySelector('.dbgbar select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'all');s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(400)
  await click('#fail'); await sleep(1800)
  out.excPaused = await shellEval(`document.querySelector('.pausedbadge')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.dbgbar .btn')].find(b=>b.textContent==='Resume')?.click()`); await sleep(600)
  await shellEval(`(()=>{const s=document.querySelector('.dbgbar select');Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype,'value').set.call(s,'none');s.dispatchEvent(new Event('change',{bubbles:true}))})()`)
  return out
}
