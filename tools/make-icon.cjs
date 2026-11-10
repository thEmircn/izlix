// build/icon.svg -> build/icon.icns (Electron ile PNG'ye cizilir; sips + iconutil ile iconset). Kullanim: npx electron tools/make-icon.cjs
const { app, BrowserWindow } = require('electron')
const { readFileSync, writeFileSync, mkdirSync } = require('node:fs')
const { execFileSync } = require('node:child_process')
const { join } = require('node:path')
app.whenReady().then(async () => {
  const build = join(__dirname, '..', 'build')
  const svg = readFileSync(join(build, 'icon.svg'), 'utf8')
  const win = new BrowserWindow({ width: 1024, height: 1024, show: false, transparent: true, frame: false, webPreferences: { offscreen: true } })
  await win.loadURL('data:text/html,' + encodeURIComponent(`<body style="margin:0;background:transparent">${svg}</body>`))
  await new Promise((r) => setTimeout(r, 400))
  const png = (await win.webContents.capturePage({ x: 0, y: 0, width: 1024, height: 1024 })).toPNG()
  writeFileSync(join(build, 'icon.png'), png)
  const set = join(build, 'icon.iconset'); mkdirSync(set, { recursive: true })
  for (const s of [16, 32, 64, 128, 256, 512, 1024]) {
    execFileSync('sips', ['-z', String(s), String(s), join(build, 'icon.png'), '--out', join(set, `i${s}.png`)], { stdio: 'ignore' })
  }
  const map = { 'icon_16x16.png': 16, 'icon_16x16@2x.png': 32, 'icon_32x32.png': 32, 'icon_32x32@2x.png': 64, 'icon_128x128.png': 128, 'icon_128x128@2x.png': 256, 'icon_256x256.png': 256, 'icon_256x256@2x.png': 512, 'icon_512x512.png': 512, 'icon_512x512@2x.png': 1024 }
  for (const [n, s] of Object.entries(map)) execFileSync('cp', [join(set, `i${s}.png`), join(set, n)])
  for (const s of [16, 32, 64, 128, 256, 512, 1024]) execFileSync('rm', [join(set, `i${s}.png`)])
  execFileSync('iconutil', ['-c', 'icns', set, '-o', join(build, 'icon.icns')])
  execFileSync('rm', ['-rf', set])
  app.quit()
})
