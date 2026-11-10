module.exports = async ({ tabs, sleep, shellEval, click }) => {
  const fs = require('fs'), out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1200)
  const p = await shellEval(`window.izlix.saveHar(${JSON.stringify(id)})`)
  const har = JSON.parse(fs.readFileSync(p, 'utf8'))
  out.entries = har.log.entries.length
  out.hasItems = har.log.entries.some((e) => /api\/items/.test(e.request.url) && e.response.status === 200)
  out.version = har.log.version
  // timeline zoom
  const ticks = () => shellEval(`[...document.querySelectorAll('svg text')].map(t=>t.textContent).filter(t=>/s$/.test(t)).join(',')`)
  const t0 = await ticks()
  await shellEval(`(()=>{const s=document.querySelector('svg circle').closest('svg');s.dispatchEvent(new WheelEvent('wheel',{deltaY:-400,clientX:1300,clientY:200,bubbles:true,cancelable:true}))})()`); await sleep(400)
  const t1 = await ticks()
  out.zoomed = t0 !== t1
  out.live = await shellEval(`!![...document.querySelectorAll('.btn')].find(b=>b.textContent.includes('live'))`)
  return out
}
