module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3500)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Sources'); await sleep(900)
  out.scripts = await shellEval(`[...document.querySelectorAll('.srclist > div > .srcitem .nm')].map(e=>e.textContent)`)
  await shellEval(`[...document.querySelectorAll('.srclist > div > .srcitem')].find(e=>e.textContent.startsWith('App.tsx')).click()`); await sleep(1500)
  out.sub = await shellEval(`[...document.querySelectorAll('.srcitem.sub')].map(e=>e.textContent)`)
  out.codeBar = await shellEval(`document.querySelector('.codebar b')?.textContent`)
  out.hasCode = await shellEval(`document.querySelector('.codebody')?.innerText.includes('useState')`)
  out.kwSpans = await shellEval(`document.querySelectorAll('.tk-kw').length`)
  // arama
  await shellEval(`(()=>{const i=document.querySelector('.codebar .search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'fetch');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(500)
  out.matches = await shellEval(`document.querySelector('.codebar')?.innerText.match(/\\d+\\/\\d+/)?.[0]`)
  // konsol stack'inden atlama: hata uret
  await pageEval(`setTimeout(()=>{ try { null.x } catch(e) { console.error(e) } }, 0); 0`); await sleep(400)
  await tab('Console'); await sleep(500)
  await shellEval(`document.querySelector('.con-row.lv-error .con-main')?.click()`); await sleep(300)
  out.stackLinks = await shellEval(`document.querySelectorAll('.stlink').length`)
  await shellEval(`document.querySelector('.stlink').click()`); await sleep(2500)
  out.jumpTab = await shellEval(`document.querySelector('.seg2 button.on')?.textContent`)
  out.jumpLine = await shellEval(`!!document.querySelector('.cl.jump')`)
  out.jumpFile = await shellEval(`document.querySelector('.codebar b')?.textContent`)
  return out
}
