module.exports = async ({ tabs, bus, sleep, shellEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  // bozuk bir render olayi: Renders paneli bunu isleyemez (components dizi degil)
  bus.emit({ tabId: id, kind: 'render', source: 'test', payload: { count: 1, components: 5 } }); await sleep(300)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Renders').click()`); await sleep(900)
  out.card = await shellEval(`!!document.querySelector('.errcard')`)
  out.shellAlive = await shellEval(`!!document.querySelector('.tabstrip') && !!document.querySelector('.addr')`)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(500)
  out.recovered = await shellEval(`!document.querySelector('.errcard') && !!document.querySelector('.net')`)
  return out
}
