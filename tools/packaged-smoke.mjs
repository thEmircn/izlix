// Paketlenmis (electron-builder --dir/unpacked) uygulamayi acar ve duman betigini calistirir. Kullanim: node tools/packaged-smoke.mjs
import { spawn } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, readdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'

const dist = resolve('dist')
const candidates = process.platform === 'darwin'
  ? readdirSync(dist).filter((d) => d.startsWith('mac')).map((d) => join(dist, d, 'Izlix.app', 'Contents', 'MacOS', 'Izlix'))
  : process.platform === 'win32' ? [join(dist, 'win-unpacked', 'Izlix.exe')] : [join(dist, 'linux-unpacked', 'izlix'), join(dist, 'linux-unpacked', 'Izlix')]
const exe = candidates.find((p) => existsSync(p))
if (!exe) { console.error('paketli uygulama bulunamadi:', candidates.join(', ')); process.exit(2) }
const ud = mkdtempSync(join(tmpdir(), 'izlix-pkg-')), out = join(ud, 'dump.json')
const env = { ...process.env, DB_USER_DATA: ud, DB_SCRIPT: resolve('tests/e2e/packaged-smoke.cjs'), DB_DUMP: out, DB_URL: '', ELECTRON_DISABLE_SANDBOX: '1' }
delete env.ELECTRON_RUN_AS_NODE
const p = spawn(exe, process.platform === 'linux' ? ['--no-sandbox'] : [], { env, stdio: 'ignore' })
let finished = false
const end = (code, msg) => {
  if (finished) return; finished = true
  console.log(msg); try { p.kill('SIGKILL') } catch {} setTimeout(() => { rmSync(ud, { recursive: true, force: true }); process.exit(code) }, 500) }
for (let i = 0; i < 120; i++) {
  await new Promise((r) => setTimeout(r, 1000))
  if (existsSync(out)) {
    const r = JSON.parse(readFileSync(out, 'utf8')).result
    end(r?.packaged === true && r?.shell === true ? 0 : 1, 'paketli uygulama: ' + JSON.stringify(r)); break
  }
}
if (!finished) end(1, 'HATA: paketli uygulama zaman asimina ugradi')
