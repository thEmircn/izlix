#!/usr/bin/env node
// izlix CLI:  izlix open [klasor]   -> klasoru Workspace olarak acar (varsayilan: bulunulan klasor)
const { spawn } = require('node:child_process')
const { resolve, join } = require('node:path')

const [cmd = 'open', arg = '.'] = process.argv.slice(2)
if (cmd !== 'open') { console.error('kullanim: izlix open [klasor]'); process.exit(2) }
const dir = resolve(process.cwd(), arg)
const root = join(__dirname, '..')
const bundled = process.env.IZLIX_APP // paketlenmis uygulama yolu (.app)
const child = bundled
  ? spawn('open', ['-a', bundled, '--args', `--open=${dir}`], { detached: true, stdio: 'ignore' })
  : spawn(require('electron'), [root, `--open=${dir}`], { detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } })
child.unref()
console.log(`izlix: ${dir} açılıyor…`)
