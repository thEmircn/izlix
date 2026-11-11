// MVP #8: Request Rules - mock, gecikme, durum kodu, yonlendirme, header, alan adi siniri, Fetch'in kapali kalmasi
module.exports = async ({ tabs, rules, refreshRules, sleep, pageEval, click, bus, shot }) => {
  const out = {}
  const fs = require('fs'); const save = (k) => fs.writeFileSync(require('os').tmpdir() + '/izlix-e2e-rules-progress.json', JSON.stringify({ at: k, out }, null, 1))
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' })
  await sleep(2500)
  const itx = tabs.get(id).interceptor
  const mk = (rid, action, p = {}) => ({ id: rid, name: rid, enabled: true, urlPattern: '/api/items', action, ...p })
  const set = async (list, domains = ['localhost']) => { rules.set('default', { rules: list, domains }); refreshRules(); await sleep(300) }
  const get = (path = '/api/items') => pageEval(`(async()=>{const t=performance.now();const r=await fetch(${JSON.stringify(path)});const b=await r.text();return {status:r.status,body:b.slice(0,120),ms:Math.round(performance.now()-t),mock:r.headers.get('x-izlix-mock')}})()`)

  save('before0')
  // 0) kural yokken Fetch alani KAPALI (sayfayi bozma ilkesi) ve davranis ham
  out.modeNoRules = itx.mode
  out.baseline = await get()

  save('before1')
  // 1) JSON mock
  await set([mk('m', { type: 'mock', status: 200, body: '{"items":[{"id":1,"name":"MOCK"}]}', contentType: 'application/json' })])
  out.modeWithRules = itx.mode
  out.mock = await get()

  save('before2')
  // 2) rozet: UI'dan gercek tiklamayla tetiklenen istek Timeline olayinda 'modified' tasimali
  await click('#load'); await sleep(1200)
  const req = bus.snapshot(id).filter((e) => e.kind === 'request' && /api\/items/.test(e.payload.url)).pop()
  out.badge = req && req.payload.modified

  save('before3')
  // 3) gecikme
  await set([mk('d', { type: 'delay', ms: 400 })])
  out.delay = await get()

  save('before4')
  // 4) durum kodu (yanit asamasi): govde gercek, kod 503
  await set([mk('s', { type: 'status', code: 503 })])
  out.modeStatus = itx.mode
  out.status = await get()

  save('before5')
  // 5) yonlendirme
  await set([mk('r', { type: 'redirect', to: 'http://localhost:5173/api/items?fail=1' }, { urlPattern: '/api/items?x' })])
  out.redirect = await get('/api/items?x=1')

  save('before6')
  // 6) cross-origin mock (CORS on kontrolu dahil): kimsenin dinlemedigi bir alan adi
  await set([mk('x', { type: 'mock', status: 201, body: '{"ok":true}', contentType: 'application/json' }, { urlPattern: 'https://api.nowhere.test/*' })])
  out.cross = await pageEval(`fetch('https://api.nowhere.test/v1/ping',{method:'POST',headers:{'content-type':'application/json'},body:'{}'}).then(async r=>({status:r.status,body:await r.text()})).catch(e=>({error:String(e)}))`)

  save('before7')
  // 7) alan adi siniri: sayfa izinli alan adinda degilse kural CALISMAZ ve Fetch kapali kalir
  await set([mk('m2', { type: 'mock', status: 200, body: '{"items":[]}', contentType: 'application/json' })], ['example.com'])
  out.modeOutOfScope = itx.mode
  out.outOfScope = await get()

  save('before8')
  // 8) devre disi kural
  await set([{ ...mk('m3', { type: 'mock', status: 200, body: '{}', contentType: 'application/json' }), enabled: false }])
  out.modeDisabled = itx.mode

  await set([mk('m4', { type: 'delay', ms: 10 })])
  await shot(require('os').tmpdir() + '/izlix-e2e-rules1.png')
  return out
}
