#!/usr/bin/env node
// izlix CLI:  izlix open [klasor] [--run]  -> klasoru Workspace olarak acar; --run: package.json'daki dev script'ini de baslatir
const { spawn } = require('node:child_process')
const { resolve, join } = require('node:path')

const argv = process.argv.slice(2)
const run = argv.includes('--run')
const [cmd = 'open', arg = '.'] = argv.filter((a) => a !== '--run')
if (cmd !== 'open') { console.error('kullanim: izlix open [klasor]'); process.exit(2) }
const dir = resolve(process.cwd(), arg)
const root = join(__dirname, '..')
const bundled = process.env.IZLIX_APP // paketlenmis uygulama yolu (.app)
const child = bundled
  ? spawn('open', ['-a', bundled, '--args', `--open=${dir}`, ...(run ? ['--run'] : [])], { detached: true, stdio: 'ignore' })
  : spawn(require('electron'), [root, `--open=${dir}`, ...(run ? ['--run'] : [])], { detached: true, stdio: 'ignore', env: { ...process.env, ELECTRON_RUN_AS_NODE: '' } })
child.unref()
console.log(`izlix: ${dir} açılıyor…`)
