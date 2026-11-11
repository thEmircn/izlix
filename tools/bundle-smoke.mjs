// Izlix Browser paketi duman testi: baslaticiyi ac, gomulu Izlix eklentisinin yuklendigini ve izlemeye basladigini dogrula.
// Kullanim: node tools/bundle-smoke.mjs <baslatici-yolu> [--no-sandbox ...]   (ek bayraklar tarayiciya iletilir)
import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const [launcher, ...extra] = process.argv.slice(2)
if (!launcher) { console.error('baslatici yolu gerekli'); process.exit(2) }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const prof = mkdtempSync(join(tmpdir(), 'izlix-bundle-')), PORT = 9877
const p = spawn(launcher, [`--user-data-dir=${prof}`, `--remote-debugging-port=${PORT}`, '--no-first-run', '--no-default-browser-check', '--window-position=-4000,-4000', ...extra, 'about:blank'], { stdio: 'ignore', shell: process.platform === 'win32' && /\.bat$/i.test(launcher) })
const done = (code, msg) => { console.log(msg); try { p.kill('SIGKILL') } catch {} setTimeout(() => { rmSync(prof, { recursive: true, force: true }); process.exit(code) }, 600) }

async function ws(url) {
  const w = new WebSocket(url); await new Promise((r, j) => { w.onopen = r; w.onerror = j })
  let id = 0; const pend = new Map(); w.onmessage = (m) => { const d = JSON.parse(m.data); pend.get(d.id)?.(d); pend.delete(d.id) }
  return { ev: (expression) => new Promise((res) => { const i = ++id; pend.set(i, res); w.send(JSON.stringify({ id: i, method: 'Runtime.evaluate', params: { expression, awaitPromise: true, returnByValue: true } })) }).then((r) => r.result?.result?.value), close: () => w.close() }
}
let sw = null
for (let i = 0; i < 90 && !sw; i++) {
  try {
    const list = (await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()).filter((t) => t.type === 'service_worker' && t.url.startsWith('chrome-extension://'))
    for (const t of list) { const c = await ws(t.webSocketDebuggerUrl); if ((await c.ev('typeof __izlix')) === 'object') { sw = c; break } c.close() }
  } catch { /* tarayici henuz hazir degil */ }
  if (!sw) await sleep(500)
}
if (!sw) done(1, 'HATA: gomulu Izlix eklentisi yuklenmedi')
else {
  const tabId = await sw.ev(`chrome.tabs.create({ url: 'about:blank' }).then((t) => t.id)`)
  await sw.ev(`__izlix.ensureAttached(${tabId}, false)`)
  const attached = await sw.ev('JSON.stringify(__izlix.attached())')
  done(attached.includes(String(tabId)) ? 0 : 1, attached.includes(String(tabId)) ? 'OK: gomulu eklenti yuklendi ve sekmeyi izlemeye aldi' : 'HATA: izleme baslamadi')
}
