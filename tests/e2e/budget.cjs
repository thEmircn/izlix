module.exports = async ({ tabs, sleep, shellEval, settings }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(4500)
  // cok siki LCP butcesi: asilir -> arac cubugu rozeti
  await shellEval(`window.izlix.setSettings({ budgets: { lcp: 1, requests: 1 } })`); await sleep(3500)
  out.chip = await shellEval(`document.querySelector('.budgetchip')?.textContent || ''`)
  // Performance paneli: butce karti ve gecmis
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Performance').click()`); await sleep(1500)
  out.cells = await shellEval(`document.querySelectorAll('.budget .bcell').length`)
  out.badCells = await shellEval(`document.querySelectorAll('.budget .bcell.bad').length`)
  // gecmis: ilk yukleme kaydedildi; yeniden yukle -> ikinci kayit -> karsilastirma
  const hist1 = await shellEval(`window.izlix.perfHistory('http://localhost:5173/').then(l => l.length)`)
  out.savedFirst = hist1 >= 1
  tabs.reload(id); await sleep(7000)
  const hist2 = await shellEval(`window.izlix.perfHistory('http://localhost:5173/').then(l => l.length)`)
  out.savedSecond = hist2 >= hist1 + 1
  // butceyi gevset: rozet kaybolur
  await shellEval(`window.izlix.setSettings({ budgets: { lcp: 60000, requests: 100000, cls: 5, inp: 10000, tbt: 60000 } })`); await sleep(3500)
  out.chipGone = (await shellEval(`document.querySelectorAll('.budgetchip').length`)) === 0
  return out
}
