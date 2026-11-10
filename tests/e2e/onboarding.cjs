// Ilk acilis: karsilama, telemetri izni, demo ve ilk nedensellik zinciri (aktivasyon hedefi), dil gecisi
module.exports = async ({ tabs, sleep, shellEval, click, bus, shot, settings, app }) => {
  const out = {}
  const fs = require('fs'), path = require('path')
  await sleep(1200)
  out.welcomeShown = await shellEval(`!!document.querySelector('[role=dialog][aria-label*="Welcome"]')`)
  out.before = settings.get().telemetry
  await shot('/private/tmp/e2e-tmp/welcome.png')
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Allow').click()`); await sleep(300)
  out.consent = settings.get().telemetry
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Open the demo').click()`); await sleep(3500)
  out.onboarded = settings.get().onboarded
  const id = tabs.list().activeId
  out.url = tabs.get(id).info.url
  await click('#load'); await sleep(1500)
  const ev = bus.snapshot(id)
  const req = ev.find((e) => e.kind === 'request' && /api\/items/.test(e.payload.url))
  out.chainLinks = ev.filter((e) => e.links.length).map((e) => `${e.kind}:${e.links.map((l) => l.certainty).join()}`).slice(0, 6)
  out.origin = req && req.payload.origin && { component: req.payload.origin.component, file: String(req.payload.origin.file).split('/').slice(-3).join('/') }
  // Timeline'i ac -> timeline.open ve chain.seen sayilari
  await sleep(1200)
  const tel = path.join(app.getPath('userData'), 'telemetry.ndjson')
  out.telemetry = fs.existsSync(tel) ? fs.readFileSync(tel, 'utf8').trim().split('\n').map((l) => JSON.parse(l).name) : []
  // dil
  await shellEval(`window.izlix.setSettings({language:'tr'})`); await sleep(400)
  out.trAddr = await shellEval(`document.querySelector('.addr').placeholder`)
  return out
}
