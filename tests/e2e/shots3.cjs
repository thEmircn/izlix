module.exports = async ({ tabs, win, sleep, click, shellEval, shot, pageEval }) => {
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`console.log('hello'); console.warn('careful'); console.error('boom'); for(let i=0;i<4;i++) console.log('repeated')`)
  await click('#load'); await sleep(300); await click('#fail'); await sleep(1500)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 button')].find(b=>b.textContent.startsWith('${n}')).click()`)
  await tab('Network'); await sleep(700); await shot(require('os').tmpdir() + '/izlix-e2e-n1.png')
  await shellEval(`document.querySelectorAll('.net-row')[document.querySelectorAll('.net-row').length-1].click()`); await sleep(700)
  await shot(require('os').tmpdir() + '/izlix-e2e-n2.png')
  await shellEval(`[...document.querySelectorAll('.drawer .seg2 button')].find(b=>b.textContent==='Response').click()`); await sleep(900); await shot(require('os').tmpdir() + '/izlix-e2e-n3.png')
  await tab('Console'); await sleep(600); await shot(require('os').tmpdir() + '/izlix-e2e-n4.png')
  await tab('Timeline'); await sleep(500); await shot(require('os').tmpdir() + '/izlix-e2e-n5.png')
  return {}
}
