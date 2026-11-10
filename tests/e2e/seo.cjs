module.exports = async ({ tabs, sleep, shellEval }) => {
  const http = require('http'), out = {}
  const html = `<!doctype html><html lang="en"><head><title>Short</title><meta name="description" content="too short"><meta property="og:title" content="OG Title"><meta name="viewport" content="width=device-width"><script type="application/ld+json">{"@type":"Article"}</script></head><body><h1>One</h1><h1>Two</h1><img src="x.png"><a href="/a">a</a><a href="https://other.example/x" rel="nofollow">b</a></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(html) })
  await new Promise((r) => srv.listen(5186, '127.0.0.1', r))
  const id = await tabs.create({ url: 'localhost:5186', workspaceId: 'default' }); await sleep(2000)
  const d = await shellEval(`window.izlix.seoAudit(${JSON.stringify(id)})`)
  out.data = { title: d.title, desc: d.description, og: Object.keys(d.og), jsonld: d.jsonld.map((j) => j.type), h1: d.h1.length, links: d.links, noAlt: d.images.noAlt, lang: d.lang }
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Meta').click()`); await sleep(1200)
  out.items = await shellEval(`[...document.querySelectorAll('.seoi')].map(e=>e.innerText.trim())`)
  out.score = await shellEval(`document.querySelector('.seo .vnum')?.innerText.replace(/\\s+/g,'')`)
  out.og = await shellEval(`document.querySelector('.ogtxt b')?.textContent`)
  srv.close()
  return out
}
