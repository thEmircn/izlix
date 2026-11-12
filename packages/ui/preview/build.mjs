// node packages/ui/preview/build.mjs -> packages/ui/preview/dist (yerel; depoya girmez). Sunmak icin: python3 -m http.server -d packages/ui/preview/dist 5188
import { build } from 'esbuild'
import { cpSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
const here = dirname(fileURLToPath(import.meta.url)), out = resolve(here, 'dist')
rmSync(out, { recursive: true, force: true }); mkdirSync(out, { recursive: true })
await build({ entryPoints: [resolve(here, 'preview.tsx')], bundle: true, format: 'iife', target: 'es2022', outfile: resolve(out, 'preview.js'), jsx: 'automatic', logLevel: 'warning', define: { 'process.env.NODE_ENV': '"development"' }, loader: { '.module.css': 'local-css', '.png': 'dataurl', '.svg': 'dataurl' }, external: [] })
writeFileSync(resolve(out, 'index.html'), '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Izlix components</title><link rel="stylesheet" href="preview.css"></head><body><div id="root"></div><script src="preview.js"></script></body></html>')
console.log('built ->', out)
