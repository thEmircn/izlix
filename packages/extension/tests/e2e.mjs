// Izlix for Chrome uctan uca testi: eklentiyi yukle, demo sayfada tikla, kenar panelinde nedensellik zincirini dogrula.
// Kullanim: node packages/extension/build.mjs && node packages/extension/tests/e2e.mjs   (CHROME_BIN: Chrome for Testing/Chromium yolu)
import { createServer } from 'node:http'
import { readFileSync, existsSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { tmpdir, homedir } from 'node:os'
import { join, extname, resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url)), app = resolve(here, '../../..')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const BIN = process.env.CHROME_BIN || join(homedir(), 'Library/Caches/ms-playwright/chromium-1248/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing')
if (!existsSync(BIN)) { console.error('CHROME_BIN bulunamadi:', BIN); process.exit(2) }

const ROOT = join(app, 'samples/demo'), PORT = 5671, DBG = 9871
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json' }
const srv = createServer((q, r) => {
  const u = new URL(q.url, 'http://x')
  if (u.pathname === '/api/items') return setTimeout(() => { r.writeHead(200, { 'content-type': 'application/json' }); r.end(JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: i, name: 'Item ' + i })))) }, 120)
  const f = join(ROOT, u.pathname === '/' ? 'index.html' : u.pathname)
  if (!f.startsWith(ROOT) || !existsSync(f)) { r.writeHead(404); return r.end() }
  r.writeHead(200, { 'content-type': TYPES[extname(f)] ?? 'application/octet-stream', 'cache-control': 'no-store' }); r.end(readFileSync(f))
})
await new Promise((r) => srv.listen(PORT, '127.0.0.1', r))

const prof = mkdtempSync(join(tmpdir(), 'izlix-ext-e2e-'))
const chrome = spawn(BIN, [`--user-data-dir=${prof}`, `--remote-debugging-port=${DBG}`, `--load-extension=${resolve(here, '../dist')}`, '--silent-debugger-extension-api', ...(process.env.CHROME_ARGS ? process.env.CHROME_ARGS.split(' ') : []), '--no-first-run', '--no-default-browser-check', '--window-position=-4000,-4000', '--window-size=1280,900', 'about:blank'], { stdio: 'ignore' })
const fails = []; const check = (name, ok, info = '') => { console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${info ? '  ' + info : ''}`); if (!ok) fails.push(name) }
const finish = async (code) => { chrome.kill('SIGKILL'); await sleep(400); rmSync(prof, { recursive: true, force: true }); srv.close(); process.exit(code) }

async function ws(url) {
  const w = new WebSocket(url); await new Promise((r, j) => { w.onopen = r; w.onerror = j })
  let id = 0; const pend = new Map(); w.onmessage = (m) => { const d = JSON.parse(m.data); pend.get(d.id)?.(d); pend.delete(d.id) }
  const send = (method, params = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); w.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (expression) => { const r = await send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true }); return r.result?.result?.value }
  return { send, ev, close: () => w.close() }
}
const targets = async () => (await (await fetch(`http://127.0.0.1:${DBG}/json/list`)).json())

let sw, swUrl
for (let i = 0; i < 60 && !sw; i++) {
  try { for (const t of (await targets()).filter((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'))) { const c = await ws(t.webSocketDebuggerUrl); if ((await c.ev('typeof __izlix')) === 'object') { sw = c; swUrl = t.url; break } c.close() } } catch {}
  if (!sw) await sleep(400)
}
check('eklenti service worker yuklendi', !!sw); if (!sw) await finish(1)
const extId = new URL(swUrl).host

// 1) hedef sekme: izlemeyi baslat, sayfayi yukle
const tabId = await sw.ev(`chrome.tabs.create({ url: 'about:blank', active: true }).then((t) => t.id)`)
await sw.ev(`__izlix.ensureAttached(${tabId}, false)`)
check('sekme izlemeye alindi', (await sw.ev(`JSON.stringify(__izlix.attached())`)).includes(String(tabId)))
await sw.ev(`chrome.tabs.update(${tabId}, { url: 'http://127.0.0.1:${PORT}/' })`); await sleep(2200)

// 2) kenar paneli sayfasi (gercek kullanimda sidePanel; testte ayni sayfa sekme olarak)
const panelTab = await sw.ev(`chrome.tabs.create({ url: 'chrome-extension://${extId}/panel.html?tabId=${tabId}', active: false }).then((t) => t.id)`)
await sleep(1500)
const panelT = (await targets()).find((t) => t.type === 'page' && t.url.includes('panel.html'))
check('panel sayfasi acildi', !!panelT); if (!panelT) await finish(1)
const panel = await ws(panelT.webSocketDebuggerUrl); await panel.send('Emulation.setDeviceMetricsOverride', { width: 520, height: 900, deviceScaleFactor: 2, mobile: false })

// 3) tikla -> zincir
await sw.ev(`chrome.debugger.sendCommand({ tabId: ${tabId} }, 'Runtime.evaluate', { expression: "document.querySelector('#load').click()" })`); await sleep(2200)
const text = await panel.ev('document.body.innerText')
check('panel Timeline basligini gosteriyor', /Timeline/.test(text))
const evCount = await sw.ev(`__izlix.bus.snapshot('tab-${tabId}').length`)
check('olaylar toplandi', evCount >= 10, `(${evCount} olay)`)
// zincir: render olayini sec (SVG daire) ve nedensellik zinciri metnini ara
await panel.ev(`[...document.querySelectorAll('svg circle')].filter(c=>c.getAttribute('fill')==='#ffb454').pop()?.dispatchEvent(new MouseEvent('click',{bubbles:true}))`); await sleep(500)
const chainText = await panel.ev('document.body.innerText')
check('nedensellik zinciri: girdi -> istek -> yanit -> render', /Cause chain|Neden zinciri/i.test(chainText) && /click button#load/.test(chainText) && /GET \/api\/items/.test(chainText) && /200 \/api\/items/.test(chainText) && /render #\d+ commit/.test(chainText))
// 3b) click-to-source: bilesen konumu source map'ten cozulur, kaynak baglantisi editor URL'si uretir
await sleep(1500) // kaynak cozumleme sayfa bosken toplu yapilir
const chainText2 = await panel.ev('document.body.innerText')
check('bilesen kaynagi cozuldu (dosya:satir)', /App\.tsx:\d+/.test(chainText2), (chainText2.match(/[\w./-]*App\.tsx:\d+/) || [''])[0])
await sw.ev('__izlix.setTestMode(true)')
const srcFile = await sw.ev(`(() => { for (const tid of __izlix.attached()) { const f = [...__izlix.knownFiles(tid)].find((x) => /App\\.tsx$/.test(x)); if (f) return f } return null })()`)
check('bilinen kaynak dosya yolu mutlak', typeof srcFile === 'string' && srcFile.startsWith('/'), String(srcFile).slice(-40))
if (srcFile) {
  const okOpen = await panel.ev(`window.izlix.openSource({ file: ${JSON.stringify(srcFile)}, line: 18, column: 3, editor: 'vscode' })`)
  check('editorde ac: bilinen dosya kabul edildi', okOpen === true, await sw.ev('__izlix.lastEditorUrl()'))
  check('editor URL: vscode://file/...:18:3', /^vscode:\/\/file\/.*App\.tsx:18:3$/.test((await sw.ev('__izlix.lastEditorUrl()')) || ''))
  check('editorde ac: bilinmeyen/hassas dosya REDDEDILDI', (await panel.ev(`window.izlix.openSource({ file: '/etc/passwd', line: 1 })`)) === false)
  check('editorde ac: .. iceren yol REDDEDILDI', (await panel.ev(`window.izlix.openSource({ file: ${JSON.stringify(srcFile + '/../../../../etc/hosts')}, line: 1 })`)) === false)
}

// 4) Request Rules: paneldeki API ile mock kurali ekle, sayfayi yenile, tikla -> mock uygulanir ve istek rozetlenir
const rule = { rules: [{ id: 'r1', name: 'mock items', enabled: true, urlPattern: '/api/items', action: { type: 'mock', status: 200, contentType: 'application/json', body: '[{"id":1,"name":"MOCKED-BY-IZLIX"}]' } }], domains: ['127.0.0.1', 'localhost'] }
await panel.ev(`window.izlix.setRules('default', ${JSON.stringify(rule)})`); await sleep(400)
check('kural kaydedildi (chrome.storage)', (await sw.ev(`__izlix.rules().rules.length`)) === 1)
await sw.ev(`chrome.tabs.reload(${tabId})`); await sleep(2200)
await sw.ev(`chrome.debugger.sendCommand({ tabId: ${tabId} }, 'Runtime.evaluate', { expression: "document.querySelector('#load').click()" })`); await sleep(2200)
const pageText = await sw.ev(`chrome.debugger.sendCommand({ tabId: ${tabId} }, 'Runtime.evaluate', { expression: 'document.body.innerText', returnByValue: true }).then((r) => r.result.value)`)
check('mock yaniti sayfaya ulasti', /MOCKED-BY-IZLIX/.test(pageText))
const badged = await sw.ev(`__izlix.bus.snapshot('tab-${tabId}').some((e) => e.kind === 'request' && /api\\/items/.test(e.payload.url) && e.payload.modified && e.payload.modified.mocked)`)
check('degistirilen istek zaman cizelgesinde rozetli', badged === true)
await panel.send('Emulation.setDeviceMetricsOverride', { width: 520, height: 900, deviceScaleFactor: 2, mobile: false })
// 5) Network ve Console panelleri (olay verisiyle) + panelde yakalanmamis hata yok
const goTab = async (re) => panel.ev(`(() => { const b = [...document.querySelectorAll('nav.rail button[role=tab]')].find((x) => ${re}.test(x.textContent)); if (!b) return false; b.click(); return true })()`)
check('Network sekmesi acildi', await goTab('/Network|Ağ|Ag/i')); await sleep(900)
if (process.env.SHOT) { const n = await panel.send('Page.captureScreenshot', { format: 'png' }); writeFileSync(process.env.SHOT.replace('.png', '-net.png'), Buffer.from(n.result.data, 'base64')) }
const netText = await panel.ev('document.body.innerText')
check('Network paneli istegi ve durum kodunu listeliyor', /items/.test(netText) && /200/.test(netText))
check('Console sekmesi acildi', await goTab('/Console|Konsol/i')); await sleep(700)
const conText = await panel.ev('document.body.innerText')
check('Console paneli hatasiz cizildi', conText.length > 40 && !/Something went wrong|Bir şeyler ters gitti/i.test(conText))
check('Elements sekmesi acildi', await goTab('/Elements|Öğeler|Ogeler/i')); await sleep(1500)
const elText = await panel.ev('document.body.innerText')
check('Elements paneli sayfa DOM agacini gosteriyor', /button|div|html/i.test(elText) && /load/i.test(elText))
check('Storage sekmesi acildi', await goTab('/Storage|Depolama/i')); await sleep(1200)
const stText = await panel.ev('document.body.innerText')
check('Storage paneli hatasiz cizildi', stText.length > 40 && !/Something went wrong|Bir şeyler ters gitti/i.test(stText))
check('Performance sekmesi acildi', await goTab('/Performance|Performans|Perf/i')); await sleep(2500)
const pfText = await panel.ev('document.body.innerText')
check('Performance paneli olcumleri gosteriyor', pfText.length > 40 && !/Something went wrong|Bir şeyler ters gitti/i.test(pfText) && /JS|DOM|Heap|Nodes|FCP|LCP/i.test(pfText))
check('Performance grubuna donuldu', await goTab('/Performance|Performans|Perf/i')); await sleep(500)
const goSub = (re) => panel.ev(`(() => { const b = [...document.querySelectorAll('[role=tab]')].find((x) => !x.closest('nav.rail') && !x.closest('[hidden]') && ${re}.test(x.textContent)); if (!b) return false; b.click(); return true })()`)
check('Coverage sekmesi acildi', await goSub('/Coverage|Kapsam/i')); await sleep(1000)
check('Coverage paneli hatasiz cizildi', (await panel.ev('document.body.innerText')).length > 40 && (await panel.ev('window.__izlixErrors.length')) === 0)
check('Profiler sekmesi acildi', await goSub('/Profiler|Profil/i')); await sleep(1000)
check('Profiler paneli hatasiz cizildi', (await panel.ev('document.body.innerText')).length > 40 && (await panel.ev('window.__izlixErrors.length')) === 0)
check('izinli olmayan CDP yontemi reddedildi', (await panel.ev(`window.izlix.dt('tab-${tabId}', 'Runtime.evaluate', { expression: '1' })`)) === null)
check('panelde yakalanmamis hata yok', (await panel.ev('window.__izlixErrors ? window.__izlixErrors.length : 0')) === 0)
// 6) panel acilinca izleme kendiliginden baslar (arac cubugu akisinin yerine gecen yol)
const tab2 = await sw.ev(`chrome.tabs.create({ url: 'http://127.0.0.1:${PORT}/', active: false }).then((t) => t.id)`); await sleep(1200)
check('ikinci sekme henuz izlenmiyor', !(await sw.ev('JSON.stringify(__izlix.attached())')).includes(String(tab2)))
await sw.ev(`chrome.tabs.create({ url: 'chrome-extension://${extId}/panel.html?tabId=${tab2}', active: false })`); await sleep(2500)
check('panel acilinca sekme otomatik izlemeye alindi', (await sw.ev('JSON.stringify(__izlix.attached())')).includes(String(tab2)))
// 7) surum denetimi: yeni bir surum etiketi gelince panelde bildirim cikar (agsiz: etiketler enjekte edilir)
await sw.ev(`__izlix.checkUpdate(['ext-v0.1.0-alpha.1', 'ext-v9.9.9', 'browser-v99.0.0'])`); await sleep(600)
const upText = await panel.ev('document.body.innerText')
check('yeni surum bildirimi gorunuyor', /Update available: 9\.9\.9|Yeni sürüm var: 9\.9\.9/.test(upText))
await sw.ev(`__izlix.checkUpdate(['ext-v0.1.0-alpha.1'])`); await sleep(500)
check('guncel surumde bildirim kalkar', !/Update available|Yeni sürüm var/.test(await panel.ev('document.body.innerText')))
// 8) izleme durdurulunca panel bildirir; "Devam" yeniden baslatir
await sw.ev(`chrome.debugger.detach({ tabId: ${tabId} }).then(() => __izlix.onDetached(${tabId}, 'canceled_by_user'))`); await sleep(900)
check('izleme durunca panel uyarir', /Tracing stopped|İzleme durduruldu/.test(await panel.ev('document.body.innerText')))
await panel.ev(`[...document.querySelectorAll('button')].find((b) => /Resume|Devam/.test(b.textContent))?.click()`); await sleep(2500)
check('Devam ile izleme yeniden basladi', (await sw.ev('JSON.stringify(__izlix.attached())')).includes(String(tabId)))
check('uyari kalkti', !/Tracing stopped|İzleme durduruldu/.test(await panel.ev('document.body.innerText')))
// chrome:// sayfasi izlenemez: panel aciklayici hata gosterir
const bad = await sw.ev(`chrome.tabs.create({ url: 'chrome://version', active: false }).then((t) => t.id)`); await sleep(800)
await sw.ev(`chrome.tabs.create({ url: 'chrome-extension://${extId}/panel.html?tabId=${bad}', active: false })`); await sleep(2000)
const badPanel = (await targets()).filter((t) => t.type === 'page' && t.url.includes('tabId=' + bad))[0]
check('chrome:// icin aciklayici hata', badPanel ? /cannot be inspected|incelenemiyor/.test(await (await ws(badPanel.webSocketDebuggerUrl)).ev('document.body.innerText')) : false)
// 9) ayarlar: proje klasoru ve editor kaydedilir; mutlak olmayan klasor reddedilir
await panel.ev(`document.querySelector('[data-testid=ext-settings]').click()`); await sleep(500)
check('ayarlar penceresi acildi', await panel.ev(`!!document.querySelector('[role=dialog] input')`))
check('baslangicta proje klasoru bos', (await sw.ev(`__izlix.prefs().root === null`)) === true)
await panel.ev(`(async () => { const i = document.querySelector('[role=dialog] input'); Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(i, '/Users/you/my-app'); i.dispatchEvent(new Event('input', { bubbles: true })); await new Promise((r) => setTimeout(r, 100)); [...document.querySelectorAll('[role=dialog] button')].find((b) => /Save|Kaydet/.test(b.textContent)).click() })()`); await sleep(700)
check('proje klasoru kaydedildi', (await sw.ev(`__izlix.prefs().root`)) === '/Users/you/my-app')
await panel.ev(`[...document.querySelectorAll('[role=dialog] [role=tab]')].find((b) => /Cursor/.test(b.textContent)).click()`); await sleep(300)
await panel.ev(`[...document.querySelectorAll('[role=dialog] button')].find((b) => /Save|Kaydet/.test(b.textContent)).click()`); await sleep(600)
check('editor kaydedildi (Cursor)', (await sw.ev(`__izlix.prefs().editor`)) === 'cursor')
await panel.ev(`document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))`); await sleep(400)
const shot = await panel.send('Page.captureScreenshot', { format: 'png' }); if (process.env.SHOT) writeFileSync(process.env.SHOT, Buffer.from(shot.result.data, 'base64'))
console.log(fails.length ? `\n${fails.length} kontrol basarisiz` : '\nTum kontroller gecti')
await finish(fails.length ? 1 : 0)
