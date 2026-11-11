module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  // minimal gecerli tek sayfalik PDF
  const pdf = '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 24 Tf 40 100 Td (PDF TEST) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF'
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'application/pdf' }); r.end(pdf) })
  await new Promise((r) => srv.listen(5431, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://localhost:5431/doc.pdf', workspaceId: 'default' }); await sleep(3500)
  const wc = tabs.get(id).view.webContents
  out.url = wc.getURL()
  out.title = wc.getTitle()
  out.contentType = await wc.executeJavaScript('document.contentType').catch(() => 'err')
  out.embed = await wc.executeJavaScript(`!!document.querySelector('embed[type="application/x-google-chrome-pdf"], embed')`).catch(() => false)
  out.failed = !!tabs.get(id).failedUrl
  srv.close(); return out
}
