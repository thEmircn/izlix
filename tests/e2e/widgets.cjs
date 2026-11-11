module.exports = async ({ tabs, sleep, shellEval, widgets, notified, settings }) => {
  const out = {}
  await tabs.create({ workspaceId: 'default' }); await sleep(1500) // bos sekme: baslangic sayfasi
  out.cards = await shellEval(`document.querySelectorAll('.wcard').length`)
  const set = (sel, v) => shellEval(`(()=>{const i=document.querySelector(${JSON.stringify(sel)});Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,${JSON.stringify(v)});i.dispatchEvent(new Event('input',{bubbles:true}));i.closest('form').requestSubmit()})()`)
  // hatirlatici: arayuzden ekle (saat + metin), listede gorunur
  await set('.wrem input', '23:59 su ic'); await sleep(900)
  out.remRow = await shellEval(`[...document.querySelectorAll('.wrem .wrow span')].map(s => s.textContent)`)
  out.remStored = widgets().reminders().length === 1 && widgets().reminders()[0].text === 'su ic'
  // vakti gelen hatirlatici bildirilir (tek sefer) ve listeden duser
  widgets().add('gecmis hatirlatici', Date.now() - 1000)
  out.fired = widgets().tick(); out.firedAgain = widgets().tick(); out.notified = notified.includes('gecmis hatirlatici')
  await sleep(21_000) // arayuz listeyi 20 sn'de bir yeniler
  out.firedHidden = !(await shellEval(`[...document.querySelectorAll('.wrem .wrow span')].map(s => s.textContent)`)).includes('gecmis hatirlatici')
  // silme
  await shellEval(`document.querySelector('.wrem .wrow .hist-x').click()`); await sleep(700)
  out.removed = widgets().reminders().filter((r) => !r.fired).length === 0
  // doviz: opt-in (varsayilan kapali); acinca TCMB kurlari
  out.ratesOff = (await shellEval(`document.querySelectorAll('.wrate').length`)) === 0
  await shellEval(`[...document.querySelectorAll('.wcard .btn')].find(b => b.textContent === 'Turn on').click()`); await sleep(4500)
  out.rates = await shellEval(`[...document.querySelectorAll('.wrate span')].map(s => s.textContent)`)
  // hava: sehir ekle
  await set('.wcard form input[placeholder="Add a city"]', 'Istanbul'); await sleep(5000)
  out.weather = await shellEval(`document.querySelector('.wbig')?.textContent || ''`)
  out.weatherCity = settings.get().widgets.weatherCity
  return out
}
