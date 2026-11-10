module.exports = async ({ tabs, sleep, shellEval, shot, pageEval }) => {
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`document.cookie='session=abc123; path=/'; localStorage.setItem('theme','dark'); localStorage.setItem('user','{"id":1}'); 0`)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Elements'); await sleep(1500)
  await shellEval(`(()=>{const i=document.querySelector('.el .search');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'load');i.dispatchEvent(new Event('input',{bubbles:true}))})()`); await sleep(400)
  await shellEval(`document.querySelector('.el-row.match').click()`); await sleep(900); await shot('/private/tmp/e2e-tmp/e1.png')
  await shellEval(`[...document.querySelectorAll('.el-detail .seg2 button')].find(b=>b.textContent==='Layout').click()`); await sleep(700); await shot('/private/tmp/e2e-tmp/e2.png')
  await tab('Storage'); await sleep(1200); await shot('/private/tmp/e2e-tmp/e3.png')
  return {}
}
