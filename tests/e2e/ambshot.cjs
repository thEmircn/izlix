module.exports = async ({ tabs, sleep, settings }) => {
  const http = require('http'), fs = require('fs')
  // koyu, YouTube benzeri sayfa: ustte video, altta baslik/yorum metni; videoda hareketli renkli sahne
  const html = `<body style="margin:0;background:#0f0f0f;color:#f1f1f1;font:14px -apple-system,sans-serif"><div style="padding:24px 40px"><div style="width:880px;height:495px;background:#000;position:relative"><video id="v" muted autoplay playsinline style="width:880px;height:495px"></video></div>
    <h2 style="margin:18px 0 6px">Ornek video basligi burada yer alir</h2><p style="color:#aaa">1,2 Mn goruntuleme · 3 gun once</p><p>Aciklama metni ve yorumlar videonun altinda okunabilir kalmalidir. Isik metni kirletmemeli.</p></div>
    <script>const c=document.createElement('canvas');c.width=640;c.height=360;const x=c.getContext('2d');let t=0;setInterval(()=>{t+=.05;const g=x.createLinearGradient(0,0,640,360);g.addColorStop(0,'hsl('+(200+Math.sin(t)*40)+',80%,45%)');g.addColorStop(1,'hsl('+(20+Math.cos(t)*30)+',90%,50%)');x.fillStyle=g;x.fillRect(0,0,640,360);x.fillStyle='#fff';x.fillRect(100+Math.sin(t)*80,120,160,90)},50);
    const v=document.getElementById('v');v.srcObject=c.captureStream(20);v.play()</script></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5291, '127.0.0.1', r))
  settings.set({ ambient: true, ambientDev: true })
  await tabs.create({ url: 'http://localhost:5291/', workspaceId: 'default' }); await sleep(4500)
  const img = await tabs.active().view.webContents.capturePage()
  fs.writeFileSync(process.env.AMB_OUT || require('os').tmpdir() + '/izlix-e2e-amb.png', img.toPNG())
  srv.close(); return { size: img.getSize() }
}
