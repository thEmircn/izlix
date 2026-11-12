// Gorsel regresyon: statik ekranlarin goruntusunu tests/visual/baseline/<platform>/ ile piksel piksel karsilastirir.
// Taban cizgisi yok -> yeni olusturulur (VISUAL_UPDATE=1 ile tum taban cizgileri yenilenir). Yalniz ayni platformun tabani karsilastirilir.
module.exports = async ({ win, sleep, shellEval }) => {
  const fs = require('fs'), path = require('path'), { nativeImage } = require('electron')
  const dir = path.join(process.cwd(), 'tests', 'visual', 'baseline', process.platform)
  fs.mkdirSync(dir, { recursive: true })
  const update = !!process.env.VISUAL_UPDATE, out = { platform: process.platform, screens: {} }
  // animasyon/gecis/imlec kapali: karsilastirma kararli olsun
  const freeze = () => shellEval(`(()=>{let s=document.getElementById('vr-freeze');if(!s){s=document.createElement('style');s.id='vr-freeze';s.textContent='*,*::before,*::after{animation:none!important;transition:none!important;caret-color:transparent!important}';document.head.appendChild(s)};return 1})()`)
  const SCREENS = [
    ['settings', 'settings.open'], ['palette', 'palette.open'], ['hub', 'svch.open'], ['shortcuts', 'shortcuts.open'],
    ['history', 'history.open'], ['bookmarks', 'bm.open'], ['downloads', 'downloads.open'], ['usage', 'usage.open'], ['notes', 'notes.open']
  ]
  await sleep(1500)
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>b.textContent==='Allow')?.click(); 1`).catch(() => {}); await sleep(300)
  await shellEval(`[...document.querySelectorAll('.dialog button')].find(b=>/Skip|Atla/.test(b.textContent))?.click(); 1`).catch(() => {}); await sleep(400)
  await freeze()
  const diff = (a, b) => { // BGRA bitmap'ler: kanal basina tolerans 6, farkli piksel orani
    const A = a.toBitmap(), B = b.toBitmap(); if (A.length !== B.length) return 1
    let bad = 0; for (let i = 0; i < A.length; i += 4) if (Math.abs(A[i] - B[i]) > 6 || Math.abs(A[i + 1] - B[i + 1]) > 6 || Math.abs(A[i + 2] - B[i + 2]) > 6) bad++
    return bad / (A.length / 4)
  }
  for (const [name, cmd] of SCREENS) {
    win.webContents.send('ui:cmd', cmd); await sleep(700); await freeze(); await sleep(200)
    const img = await win.webContents.capturePage(), file = path.join(dir, name + '.png')
    if (update || !fs.existsSync(file)) { fs.writeFileSync(file, img.toPNG()); out.screens[name] = 'baseline-written'; }
    else { const base = nativeImage.createFromBuffer(fs.readFileSync(file)); const sz = base.getSize(), cz = img.getSize(); out.screens[name] = sz.width !== cz.width || sz.height !== cz.height ? 1 : Number(diff(base, img).toFixed(5)) }
    // kesin kapat: Esc gonder, tum katmanlar kalkana kadar bekle (yavas ortamlarda bir sonraki ekran onceki katmani gostermesin)
    await shellEval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 1`)
    for (let i = 0; i < 25; i++) { if (!(await shellEval(`!!document.querySelector('.overlay')`))) break; await sleep(150); if (i % 5 === 4) await shellEval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true})); 1`) }
    await sleep(250)
  }
  out.maxDiff = Math.max(0, ...Object.values(out.screens).filter((v) => typeof v === 'number'))
  return out
}
