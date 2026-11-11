module.exports = async ({ tabs, sleep, settings, pageEval }) => {
  const http = require('http'), out = {}
  // kirmizi dolgulu canvas -> captureStream -> oynayan video (internetsiz test)
  const html = `<body style="margin:0;background:#111"><video id="v" muted autoplay playsinline style="width:640px;height:360px;margin:200px"></video><script>
    const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');
    setInterval(()=>{x.fillStyle='rgb(230,20,20)';x.fillRect(0,0,320,180)},50);
    const v=document.getElementById('v');v.srcObject=c.captureStream(20);v.play().catch(()=>{});</script></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5251, '127.0.0.1', r))
  settings.set({ ambient: true, ambientDev: false })
  await tabs.create({ url: 'http://localhost:5251/', workspaceId: 'default' }); await sleep(3000)
  out.devSkipped = await pageEval(`!document.getElementById('__db-ambient')`)
  settings.set({ ambientDev: true })
  await tabs.create({ url: 'http://localhost:5251/', workspaceId: 'default' }); await sleep(3500)
  out.created = await pageEval(`!!document.getElementById('__db-ambient')`)
  out.opacity = await pageEval(`parseFloat(getComputedStyle(document.getElementById('__db-ambient')).opacity)`)
  out.pixel = await pageEval(`(()=>{const e=document.getElementById('__db-ambient');const d=e.getContext('2d').getImageData(16,9,1,1).data;return d[0]>180&&d[1]<80&&d[2]<80})()`)
  out.clipped = await pageEval(`getComputedStyle(document.getElementById('__db-ambient')).clipPath.startsWith('polygon')`)
  // kapat -> saydam
  await pageEval(`window.__dbAmbient.on=false`); await sleep(900)
  out.offOpacity = await pageEval(`parseFloat(getComputedStyle(document.getElementById('__db-ambient')).opacity)`)
  srv.close(); return out
}
