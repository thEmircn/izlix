// 2000 bilesende Inspector: agac alma suresi ve sanallastirilmis listede kaydirma kare suresi
module.exports = async (ctx) => {
  const { tabs, sleep, shellEval, shot } = ctx
  const out = {}
  await tabs.create({ url: 'localhost:5173/?n=2000', workspaceId: 'default' }); await sleep(4000)
  await ctx.shellEval(`[...document.querySelectorAll('b')].find(b=>b.textContent==='Components').click()`); await sleep(1500)
  out.nodes = await shellEval(`(async()=>{const t=performance.now();const r=await window.izlix.inspectTree(${JSON.stringify(tabs.list().activeId)});return {n:r.nodes.length,ms:Math.round(performance.now()-t)}})()`)
  await sleep(800)
  out.scroll = await shellEval(`new Promise(res=>{const el=document.querySelector('[data-testid=tree]');const frames=[];let last=performance.now();let y=0;let n=0;function step(){const now=performance.now();frames.push(now-last);last=now;y+=60;el.scrollTop=y;if(++n<120)requestAnimationFrame(step);else{frames.shift();frames.sort((a,b)=>a-b);res({frames:frames.length,medianMs:+frames[frames.length>>1].toFixed(1),p95Ms:+frames[Math.floor(frames.length*0.95)].toFixed(1),maxMs:+frames[frames.length-1].toFixed(1),rowsInDom:el.firstChild.children.length,total:el.firstChild.style.height})}}requestAnimationFrame(step)})`)
  await shot('/private/tmp/e2e-tmp/inspector-big.png')
  return out
}
