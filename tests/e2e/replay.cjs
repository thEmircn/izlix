module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const http = require('http'), out = {}
  const page = '<title>rp</title><body style="font:16px sans-serif;padding:20px"><input placeholder="E-posta" style="display:block;margin:10px"><input type="password" placeholder="Sifre" style="display:block;margin:10px"><button id="b" onclick="document.getElementById(\'out\').textContent=\'Merhaba \'+document.querySelector(\'input\').value">Giris</button><p id="out"></p><select id="s" onchange="document.getElementById(\'sel\').textContent=this.value"><option value="a">A</option><option value="b">B</option></select><span id="sel"></span></body>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); r.end(page) })
  await new Promise((r) => srv.listen(5621, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5621/', workspaceId: 'default' }); await sleep(1500)
  const rep = (steps, t) => shellEval(`window.izlix.recReplay(${JSON.stringify(steps)}, ${t || 5000})`)
  const E = { k: 'placeholder', v: 'E-posta' }
  // 1) basarili akis: gotoo, yazma, sifre atlanir, tiklama
  const r1 = await rep([{ t: 'goto', url: 'http://localhost:5621/' }, { t: 'fill', sel: E, value: 'ali' }, { t: 'fill', sel: { k: 'placeholder', v: 'Sifre' }, value: '', secret: true }, { t: 'click', sel: { k: 'role', role: 'button', name: 'Giris' } }, { t: 'select', sel: { k: 'css', v: '#s' }, value: 'b' }])
  out.ok = r1.ok; out.skipped = r1.skipped; out.failCount = r1.fail
  out.result = await pageEval(`document.getElementById('out').textContent`)
  out.selected = await pageEval(`document.getElementById('sel').textContent`)
  // 2) basarisiz: olmayan oge -> kisa zaman asimi, ilk hatada durur
  const r2 = await rep([{ t: 'click', sel: { k: 'text', v: 'Yok boyle bir oge' } }, { t: 'click', sel: { k: 'role', role: 'button', name: 'Giris' } }], 700)
  out.failFail = r2.fail; out.failOk = r2.ok; out.failMsg = r2.error
  // 3) kaydedici -> oynatma: gercek olaylarla kaydedilenler tekrar oynatilabilir
  return out
}
