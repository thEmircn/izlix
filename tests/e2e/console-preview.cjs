module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`console.log({a: 1, b: [1, 2], c: 'x'}); console.log('label:', 42, null, undefined, true, [1, 2, 3]); console.log(new Map([[1,2]]), function foo() { return 1 }, new Error('boom')); 0`)
  await sleep(500)
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Console').click()`); await sleep(600)
  out.msgs = await shellEval(`[...document.querySelectorAll('.con-row .msg')].map(m=>m.textContent)`)
  return out
}
