// Yogun olay akisinda (160 istek/sn) Overview/Network/Timeline akici kalmali (regresyon: binlerce olayda arayuz donuyordu)
module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const html = '<!doctype html><title>L</title><script>let n=0;setInterval(()=>{for(let i=0;i<16;i++)fetch("/api/a?"+(n++));if(n%50==0)fetch("/api/bad")},100)</script>'
  const srv = http.createServer((q, r) => { if (q.url.startsWith('/api/bad')) { r.writeHead(500); r.end('x'); return } if (q.url.startsWith('/api')) { r.writeHead(200, { 'content-type': 'application/json' }); r.end('x'.repeat(500)); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5192, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5192', workspaceId: 'default' })
  const measure = () => shellEval(`new Promise((res)=>{let f=0,max=0,last=performance.now();const t0=last;const step=(t)=>{f++;max=Math.max(max,t-last);last=t;if(t-t0<3000)requestAnimationFrame(step);else res({fps:Math.round(f/3),maxGapMs:Math.round(max)})};requestAnimationFrame(step)})`)
  await sleep(40000) // ~3000+ olay birikir
  const dash = (on) => shellEval(`(()=>{const b=document.querySelector('.dash-btn'); if (b && (b.getAttribute('aria-pressed')==='true') !== ${on}) b.click()})()`)
  for (const n of ['Overview', 'Network', 'Timeline']) {
    if (n === 'Overview') await dash(true)
    else { await dash(false); await sleep(300); await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent.startsWith(${JSON.stringify(n)}))?.click()`) }
    await sleep(1500)
    out[n] = await measure()
  }
  out.eventsInStore = Number((await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent.startsWith('Raw'))?.textContent`)).match(/\((\d+)\)/)[1])
  srv.close(); return out
}
