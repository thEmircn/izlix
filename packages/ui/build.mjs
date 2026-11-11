// Izlix UI galerisi derleme betigi: node packages/ui/build.mjs -> packages/ui/gallery/dist (GitHub Pages icin statik)
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url)), out = resolve(here, 'gallery/dist')
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
await build({ entryPoints: [resolve(here, 'gallery/gallery.tsx')], bundle: true, format: 'esm', target: 'es2022', outdir: out, jsx: 'automatic', minify: true, logLevel: 'warning', define: { 'process.env.NODE_ENV': '"production"' }, loader: { '.module.css': 'local-css' } })
cpSync(resolve(here, 'gallery/index.html'), resolve(out, 'index.html'))
console.log('Izlix UI gallery built ->', out)
