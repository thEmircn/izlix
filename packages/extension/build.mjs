// Izlix for Chrome derleme betigi: node packages/extension/build.mjs  ->  packages/extension/dist
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url)), out = resolve(here, 'dist')
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
const common = { bundle: true, format: 'esm', target: 'chrome120', logLevel: 'warning', sourcemap: false, legalComments: 'none' }
await build({ ...common, entryPoints: [resolve(here, 'src/background.ts')], outfile: resolve(out, 'background.js'), platform: 'browser' })
await build({
  ...common, entryPoints: [resolve(here, 'src/panel.tsx')], outdir: out, platform: 'browser', jsx: 'automatic', minify: true,
  loader: { '.woff2': 'file', '.woff': 'file', '.ttf': 'file', '.svg': 'dataurl', '.png': 'dataurl' },
  define: { 'process.env.NODE_ENV': '"production"' }
})
cpSync(resolve(here, 'manifest.json'), resolve(out, 'manifest.json'))
cpSync(resolve(here, 'src/panel.html'), resolve(out, 'panel.html'))
if (existsSync(resolve(here, 'icons'))) cpSync(resolve(here, 'icons'), resolve(out, 'icons'), { recursive: true })
console.log('Izlix for Chrome built ->', out)
