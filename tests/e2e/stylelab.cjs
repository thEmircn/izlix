module.exports = async ({ tabs, sleep, shellEval: rawEval, pageEval, shot }) => {
  const http = require('http'), out = {}
  const shellEval = async (c) => { try { return await rawEval(c) } catch (e) { out.err = (out.err || '') + c.slice(0, 70) + ' || '; return null } }
  const html = '<!doctype html><title>s</title><body><div id="card" style="padding:4px;color:#333">Hello</div>'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5193, '127.0.0.1', r))
  await tabs.create({ url: 'localhost:5193', workspaceId: 'default' }); await sleep(2000)
  const rail = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent===${JSON.stringify(n)})?.click()`)
  await rail('Style Lab'); await sleep(1200)
  await shellEval(`(()=>{const rows=[...document.querySelectorAll('.el-tree [class*=row], .el-tree div')].filter(d=>d.textContent.startsWith('<div')&&d.textContent.includes('card')); (rows[0]||document.createElement('i')).click()})()`); await sleep(1200)
  out.hasLab = await shellEval(`!!document.querySelector('.lab')`)
  // padding-top -> 16, renk degistir
  await shellEval(`(()=>{const el=document.querySelector('.lab-n[title="padding-top"] input'); const set=Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set; set.call(el,'16'); el.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(700)
  out.pageStyle = await pageEval(`document.getElementById('card').getAttribute('style')`)
  out.chips = await shellEval(`[...document.querySelectorAll('.lab-chips .rchip')].map(c=>c.textContent)`)
  out.css = await shellEval(`document.querySelector('.lab-code pre')?.textContent`)
  out.tw = await shellEval(`[...document.querySelectorAll('.lab-code pre')][1]?.textContent`)
  await shot(require('os').tmpdir() + '/izlix-e2e-stylelab.png')
  await shellEval(`[...document.querySelectorAll('.lab button')].find(b=>b.textContent==='Reset all').click()`); await sleep(700)
  out.afterReset = await pageEval(`document.getElementById('card').getAttribute('style')`)
  srv.close(); return out
}
