// Storage paneli: cookie, localStorage, sessionStorage, IndexedDB, Cache
module.exports = async ({ tabs, sleep, shellEval, pageEval }) => {
  const out = {}
  await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  await pageEval(`document.cookie='sess=abc; path=/'; localStorage.setItem('theme','dark'); sessionStorage.setItem('tmp','1'); 0`)
  await pageEval(`new Promise(r=>{const q=indexedDB.open('appdb',3);q.onupgradeneeded=()=>{q.result.createObjectStore('items',{keyPath:'id'})};q.onsuccess=()=>{q.result.close();r(1)}})`)
  await pageEval(`caches.open('v1').then(c=>c.put('/x', new Response('hi'))).then(()=>1)`)
  const tab = (n) => shellEval(`[...document.querySelectorAll('.seg2 > button')].find(b=>b.textContent==='${n}').click()`)
  const sub = (n) => shellEval(`[...document.querySelectorAll('.st .seg2 button')].find(b=>b.textContent==='${n}').click()`)
  await tab('Storage'); await sleep(1500)
  out.cookie = await shellEval(`[...document.querySelectorAll('.st-tbl td.k')].map(e=>e.textContent)`)
  // cookie degeri duzenle
  await shellEval(`(()=>{const r=[...document.querySelectorAll('.st-tbl tr')].find(r=>r.querySelector('td.k')?.textContent==='sess');const i=r.querySelector('input');i.focus();Object.getOwnPropertyDescriptor(HTMLInputElement.prototype,'value').set.call(i,'changed');i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))})()`); await sleep(800)
  out.cookieEdited = await pageEval(`document.cookie`)
  await sub('localStorage'); await sleep(800)
  out.local = await shellEval(`[...document.querySelectorAll('.st-tbl td.k')].map(e=>e.textContent)`)
  await shellEval(`[...document.querySelectorAll('.st-tbl tr')].find(r=>r.querySelector('td.k')?.textContent==='theme').querySelector('.icon-btn').click()`); await sleep(800)
  out.localDeleted = await pageEval(`localStorage.getItem('theme')`)
  await sub('sessionStorage'); await sleep(800)
  out.session = await shellEval(`[...document.querySelectorAll('.st-tbl td.k')].map(e=>e.textContent)`)
  await sub('IndexedDB'); await sleep(1200)
  out.idb = await shellEval(`document.querySelector('.idb')?.innerText`)
  await sub('Cache'); await sleep(1200)
  out.cache = await shellEval(`document.querySelector('.idb')?.innerText`)
  return out
}
