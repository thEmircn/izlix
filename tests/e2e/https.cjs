// Kendinden imzali yerel HTTPS acilir; baska alan adlarinda dogrulama gevsemez
module.exports = async ({ tabs, sleep }) => {
  const https = require('https'), cp = require('child_process'), fs = require('fs')
  const d = require('os').tmpdir() + '/izlix-e2e-cert'; fs.mkdirSync(d, { recursive: true })
  cp.execFileSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-keyout', d + '/k.pem', '-out', d + '/c.pem', '-days', '2', '-subj', '/CN=localhost'], { stdio: 'ignore' })
  const srv = https.createServer({ key: fs.readFileSync(d + '/k.pem'), cert: fs.readFileSync(d + '/c.pem') }, (q, r) => r.end('<title>secure-local</title>hi'))
  await new Promise((r) => srv.listen(5195, '127.0.0.1', r))
  const out = {}
  const id = await tabs.create({ url: 'https://localhost:5195/', workspaceId: 'default' }); await sleep(2500)
  out.title = tabs.get(id).view.webContents.getTitle()
  const bad = await tabs.create({ url: 'https://self-signed.badssl.com/', workspaceId: 'default' }); await sleep(4000)
  out.badssl = tabs.get(bad).view.webContents.getURL() + '|' + tabs.get(bad).view.webContents.getTitle()
  out.badBody = await tabs.get(bad).view.webContents.executeJavaScript('document.body ? document.body.innerText.slice(0, 40) : ""').catch((e) => 'ERR')
  srv.close()
  return out
}
