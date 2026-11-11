module.exports = async ({ tabs, sleep, pageEval, shellEval }) => {
  const http = require('http'), out = {}
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>ok</title>x') })
  await new Promise((r) => srv.listen(5655, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://sub.malware-test.invalid/path', workspaceId: 'default' }); await sleep(2000)
  out.malTitle = await pageEval('document.title'); out.malText = (await pageEval('document.body.innerText')).slice(0, 120)
  const id2 = await tabs.create({ url: 'https://paypa1.com/', workspaceId: 'default' }); await sleep(2000)
  out.lookTitle = await pageEval('document.title'); out.lookBrand = (await pageEval('document.body.innerText')).includes('paypal')
  await tabs.create({ url: 'localhost:5655', workspaceId: 'default' }); await sleep(1500)
  out.okTitle = await pageEval('document.title')
  tabs.activate(id); await sleep(500)
  await pageEval(`document.querySelector('a.b:not(.p)').click()`); await sleep(2500)
  out.afterProceed = await pageEval('document.title')
  await shellEval(`window.izlix.setSettings({ safeBrowsing: false })`); await sleep(300)
  await tabs.create({ url: 'http://other.malware-test.invalid/', workspaceId: 'default' }); await sleep(2000)
  out.offTitle = await pageEval('document.title')
  srv.close(); return out
}
