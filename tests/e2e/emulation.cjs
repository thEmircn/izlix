module.exports = async ({ tabs, sleep, pageEval, shellEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  const t = (code) => pageEval(`(async()=>{const s=performance.now();try{${code}}catch(e){return {err:String(e).slice(0,40),ms:Math.round(performance.now()-s)}}})()`)
  out.base = await t(`await fetch('/api/items?x=1');return {ms:Math.round(performance.now()-s)}`)
  await tabs.setEmulation(id, { network: 'slow-3g' }); await sleep(300)
  out.slow = await t(`await fetch('/api/items?x=2');return {ms:Math.round(performance.now()-s)}`)
  await tabs.setEmulation(id, { network: 'offline' }); await sleep(300)
  out.offline = await t(`await fetch('/api/items?x=3');return {ms:0}`)
  await tabs.setEmulation(id, { network: null }); await sleep(300)
  out.restored = await t(`await fetch('/api/items?x=4');return {ms:Math.round(performance.now()-s)}`)
  const busy = `const a=performance.now();let x=0;for(let i=0;i<3e6;i++)x+=Math.sqrt(i);return {ms:Math.round(performance.now()-a)}`
  out.cpu1 = await t(busy)
  await tabs.setEmulation(id, { cpu: 6 }); await sleep(300)
  out.cpu6 = await t(busy)
  await tabs.setEmulation(id, { cpu: null })
  await tabs.setEmulation(id, { geo: 'tokyo' }); await sleep(300)
  out.geo = await pageEval(`new Promise(r=>navigator.geolocation.getCurrentPosition(p=>r([p.coords.latitude.toFixed(2),p.coords.longitude.toFixed(2)]),e=>r('ERR '+e.code),{timeout:3000}))`)
  out.tz = await pageEval(`Intl.DateTimeFormat().resolvedOptions().timeZone`)
  out.locale = await pageEval(`Intl.DateTimeFormat().resolvedOptions().locale`)
  out.chip = await shellEval(`document.querySelector('.chip.emu')?.textContent`)
  await tabs.setEmulation(id, { geo: null }); await sleep(300)
  out.tzReset = await pageEval(`Intl.DateTimeFormat().resolvedOptions().timeZone`)
  out.info = tabs.get(id).info.emu ?? null
  return out
}
