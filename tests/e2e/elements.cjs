// Elements paneli: DOM agaci, secim, stil/yerlesim/oznitelik duzenleme, React bileseni, dugum silme
module.exports = async (ctx) => { const out = {}; try { return await main(ctx, out) } catch (e) { out.fail = String(e.message || e).slice(0, 200); return out } }
async function main({ tabs, sleep, shellEval: se, pageEval }, out) {
  const shellEval = (c) => se(c).catch((e) => { (out.errs = out.errs || []).push(c.slice(0, 70)); return null })
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Elements'); await sleep(1500)
  out.rows = await shellEval(`document.querySelectorAll('.el-row').length`)
  out.hasHtml = await shellEval(`[...document.querySelectorAll('.el-row')].some(r=>r.textContent.startsWith('<html'))`)
  // #load dugumunu bul: arama kutusuyla
  await shellEval(`(()=>{const i=document.querySelector('.el .search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'load');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(500)
  out.matches = await shellEval(`document.querySelectorAll('.el-row.match').length`)
  await shellEval(`document.querySelector('.el-row.match').click()`); await sleep(900)
  out.crumb = await shellEval(`document.querySelector('.el-crumb')?.textContent`)
  out.inlineBox = await shellEval(`!!document.querySelector('.styles textarea')`)
  // inline style duzenle
  await shellEval(`(()=>{const t=document.querySelector('.styles textarea');Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype,'value').set.call(t,'outline: 3px solid red');t.dispatchEvent(new Event('input',{bubbles:true}));t.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',metaKey:true,bubbles:true}))})()`); await sleep(700)
  out.pageStyle = await pageEval(`document.querySelector('#load').getAttribute('style')`)
  out.dbg = await shellEval(`[...document.querySelectorAll('.el-detail button')].map(b=>b.textContent).join('|')`)
  await shellEval(`[...document.querySelectorAll('.el-detail .seg2 button')].find(b=>b.textContent==='Layout').click()`); await sleep(900)
  out.layout = await shellEval(`document.querySelector('.bx.content')?.textContent`)
  await shellEval(`[...document.querySelectorAll('.el-detail .seg2 button')].find(b=>b.textContent==='Attributes').click()`); await sleep(500)
  await shellEval(`(()=>{const [n,v]=document.querySelectorAll('.arow.add input');const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set;set.call(n,'data-x');n.dispatchEvent(new Event('input',{bubbles:true}));set.call(v,'42');v.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(200)
  await shellEval(`document.querySelector('.arow.add button').click()`); await sleep(800)
  out.pageAttr = await pageEval(`document.querySelector('#load').getAttribute('data-x')`)
  await shellEval(`[...document.querySelectorAll('.el-detail .seg2 button')].find(b=>b.textContent==='React').click()`); await sleep(900)
  out.react = await shellEval(`document.querySelector('.rchain')?.innerText`)
  await shellEval(`[...document.querySelectorAll('.el-detail .seg2 button')].find(b=>b.textContent==='Computed').click()`); await sleep(800)
  out.computed = await shellEval(`document.querySelectorAll('.el-pane .prop').length`)
  // dugum sil
  await shellEval(`[...document.querySelectorAll('.el-detail .seg2 button')].find(b=>b.textContent==='Attributes').click()`); await sleep(400)
  await shellEval(`[...document.querySelectorAll('.actions button')].find(b=>b.textContent==='Delete node').click()`); await sleep(900)
  out.deleted = await pageEval(`!document.querySelector('#load')`)
  await tab('Timeline'); await sleep(300)
  return out
}
