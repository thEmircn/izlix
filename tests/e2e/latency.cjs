// Timeline olay gecikmesi: olayin main'de olusmasindan shell DOM'unda gorunmesine kadar (hedef < 100 ms)
module.exports = async ({ tabs, bus, sleep, shellEval }) => {
  const id = await tabs.create({ url: 'about:blank', workspaceId: 'default' }); await sleep(1500)
  const count = () => shellEval(`(()=>{const m=[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent.startsWith('Raw'));return m?Number((m.textContent.match(/\\((\\d+)\\)/)||[])[1]):-1})()`)
  const samples = []
  for (let i = 0; i < 30; i++) {
    const before = await count()
    const t0 = Date.now()
    bus.emit({ tabId: id, kind: 'console', source: 'test', payload: { level: 'log', text: 'x' + i } })
    let seen = false
    while (Date.now() - t0 < 1000) { if ((await count()) > before) { seen = true; break } await sleep(2) }
    samples.push(seen ? Date.now() - t0 : 1000)
    await sleep(120)
  }
  samples.sort((a, b) => a - b)
  return { n: samples.length, medianMs: samples[15], p95Ms: samples[Math.floor(samples.length * 0.95)], maxMs: samples[samples.length - 1] }
}
