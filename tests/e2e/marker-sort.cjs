module.exports = async ({ tabs, win, sleep, shellEval, click, exportReport }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await click('#load'); await sleep(1000)
  win.webContents.send('ui:cmd', 'marker.open'); await sleep(500)
  await shellEval(`(()=>{const i=document.querySelector('[role=dialog] input');Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'bug burada');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(700)
  out.markerLine = await shellEval(`document.querySelectorAll('svg g.marker').length`)
  out.markerText = await shellEval(`document.querySelector('svg g.marker text')?.textContent`)
  await shellEval(`document.querySelector('svg g.marker').dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(300)
  out.detail = await shellEval(`document.body.innerText.includes('Marker: bug burada')`)
  const file = '/private/tmp/e2e-tmp/marker-report.zip'
  await exportReport(file)
  out.reportHas = require('child_process').execFileSync('unzip', ['-p', file, 'summary.md']).toString().includes('bug burada')
  // Network siralama
  await shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='Network').click()`); await sleep(600)
  const sizes = () => shellEval(`[...document.querySelectorAll('.net-row')].map(r=>r.children[3].innerText)`)
  const toBytes = (t) => { const m = /^([\d.]+)\s*(B|kB|MB)$/.exec(t); return m ? Number(m[1]) * ({ B: 1, kB: 1024, MB: 1048576 }[m[2]]) : -1 }
  await shellEval(`[...document.querySelectorAll('.hsort')].find(b=>b.textContent.startsWith('Size')).click()`); await sleep(300)
  await shellEval(`[...document.querySelectorAll('.hsort')].find(b=>b.textContent.startsWith('Size')).click()`); await sleep(300) // azalan
  const s = (await sizes()).map(toBytes).filter((x) => x >= 0)
  out.desc = s.every((v, i) => i === 0 || s[i - 1] >= v)
  out.head = await shellEval(`[...document.querySelectorAll('.hsort')].find(b=>b.textContent.startsWith('Size')).textContent`)
  return out
}
