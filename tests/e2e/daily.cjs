module.exports = async ({ tabs, sleep, shellEval: se, pageEval }) => {
  const http = require('http'), out = {}
  const shellEval = (c) => se(c).catch((e) => 'ERR ' + e)
  const html = `<body><video id="v" muted autoplay playsinline style="width:400px;height:225px"></video><script>
    const c=document.createElement('canvas');c.width=320;c.height=180;const x=c.getContext('2d');setInterval(()=>{x.fillStyle='#2a6';x.fillRect(0,0,320,180)},50);
    const v=document.getElementById('v');v.srcObject=c.captureStream(20);v.play().catch(()=>{});</script></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url === '/novideo' ? '<p>x</p>' : html) })
  await new Promise((r) => srv.listen(5261, '127.0.0.1', r))
  const a = await tabs.create({ url: 'http://localhost:5261/novideo', workspaceId: 'default' }); await sleep(1500)
  const b = await tabs.create({ url: 'http://localhost:5261/novideo?b', workspaceId: 'default' }); await sleep(1500)
  const c = await tabs.create({ url: 'http://localhost:5261/', workspaceId: 'default' }); await sleep(2500)
  // sabitle: sona eklenen sekme basa gelir, pinned bayragi
  await shellEval(`window.izlix.pinTab('${c}', true)`); await sleep(500)
  const L = () => tabs.list().tabs
  out.pinnedFirst = L()[0].id === c && L()[0].pinned === true
  await shellEval(`window.izlix.pinTab('${b}', true)`); await sleep(300)
  out.twoPinned = L().filter((t) => t.pinned).length === 2 && L()[0].pinned && L()[1].pinned && !L()[2].pinned
  out.pinnedClass = await shellEval(`document.querySelectorAll('.tab.pinned').length`)
  out.pinnedNoClose = await shellEval(`[...document.querySelectorAll('.tab.pinned')].every(t=>!t.querySelector('button'))`)
  await shellEval(`window.izlix.pinTab('${b}', false)`); await sleep(300)
  out.unpinned = L().filter((t) => t.pinned).length === 1
  // PiP: videosu olmayan sayfada 'none'; videolu sayfada ok/error (ortama bagli) ama cokmez
  tabs.activate(a); await sleep(400)
  out.pipNone = await shellEval(`window.izlix.pip()`)
  tabs.activate(c); await sleep(600)
  out.pipVideo = await shellEval(`window.izlix.pip()`)
  srv.close(); return out
}
