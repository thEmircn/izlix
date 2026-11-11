module.exports = async ({ tabs, win, sleep, shellEval, pageEval }) => {
  const http = require('http'), out = {}
  let asked = 0, lastBody = ''
  const llm = http.createServer((q, r) => { let b = ''; q.on('data', (c) => (b += c)); q.on('end', () => { asked++; lastBody = b; r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify({ message: { content: 'Sebep: items undefined. Cozum: varsayilan [] ver.' } })) }) })
  const app = http.createServer((q, r) => { if (q.url.startsWith('/api')) { r.writeHead(500, { 'content-type': 'application/json' }); r.end('{"e":1}'); return } r.writeHead(200, { 'content-type': 'text/html' }); r.end('<title>ai</title><body>x</body>') })
  await new Promise((r) => llm.listen(5631, '127.0.0.1', r)); await new Promise((r) => app.listen(5632, '127.0.0.1', r))
  await shellEval(`window.izlix.setSettings({ ai: { provider: 'ollama', model: 'test-model', endpoint: 'http://127.0.0.1:5631' } })`)
  await tabs.create({ url: 'http://localhost:5632/', workspaceId: 'default' }); await sleep(1800)
  await pageEval(`fetch('/api/items?token=ABCSECRET987654&x=1').catch(()=>0); setTimeout(()=>{ try { null.map(()=>1) } catch(e) { console.error(e.message + ' Bearer abcdefghijklmnop') } }, 100); 1`); await sleep(1800)
  win.webContents.send('ui:cmd', 'ai.explain'); await sleep(1200)
  out.dialog = await shellEval(`!!document.querySelector('[role=dialog][aria-label="Explain with AI"]')`)
  const prompt = await shellEval(`document.querySelector('.ai-prompt')?.value || ''`)
  out.hasError = prompt.includes('Cannot read properties of null') && prompt.includes('REQUEST FAILED') && prompt.includes('/api/items?…')
  out.masked = !prompt.includes('ABCSECRET987654') && !prompt.includes('abcdefghijklmnop')
  out.local = (await shellEval(`document.querySelector('.ai-target')?.className`)).includes('local')
  out.nothingSentYet = asked === 0 // onizleme asamasinda hicbir istek yok
  await shellEval(`[...document.querySelectorAll('.ai-body .btn')].find(b => b.textContent === 'Send').click()`); await sleep(2500)
  out.answer = await shellEval(`document.querySelector('.ai-answer')?.textContent || ''`)
  out.sentOnce = asked === 1
  out.bodyMasked = lastBody.includes('test-model') && !lastBody.includes('ABCSECRET987654') && lastBody.includes('Cannot read properties')
  // bulut saglayici: anahtar yok -> Gonder kapali; anahtar kaydi (arayuze geri donmez)
  await shellEval(`document.querySelector('.dialog.ai').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  await shellEval(`window.izlix.setSettings({ ai: { provider: 'anthropic', model: 'claude-sonnet-5-5' } })`); await sleep(300)
  win.webContents.send('ui:cmd', 'ai.explain'); await sleep(1200)
  out.noKeyDisabled = await shellEval(`[...document.querySelectorAll('.ai-body .btn')].find(b => b.textContent === 'Send').disabled`)
  out.remoteBadge = (await shellEval(`document.querySelector('.ai-target')?.textContent`)).includes('api.anthropic.com')
  await shellEval(`document.querySelector('.dialog.ai').dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`); await sleep(300)
  const k = await shellEval(`window.izlix.aiKey('anthropic', 'sk-ant-test-123')`)
  out.keySaved = k.saved === true && k.hasKey === true && !JSON.stringify(k).includes('sk-ant')
  const pv = await shellEval(`window.izlix.aiPreview()`)
  out.hasKeyNow = pv.hasKey === true && !JSON.stringify(pv).includes('sk-ant')
  llm.close(); app.close(); return out
}
