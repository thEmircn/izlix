// Uretim bagimliliklarinin lisans bildirimini uretir: node tools/notices.mjs > THIRD_PARTY_NOTICES.md
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd(), pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'))
const seen = new Map()
function visit(name, from) {
  if (seen.has(name)) return
  const dir = [join(from, 'node_modules', name), join(root, 'node_modules', name)].find((d) => existsSync(join(d, 'package.json')))
  if (!dir) return
  const p = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'))
  const lic = typeof p.license === 'string' ? p.license : p.license?.type ?? (p.licenses ? p.licenses.map((l) => l.type).join(' OR ') : 'UNKNOWN')
  const file = readdirSync(dir).find((f) => /^(licen[sc]e|copying)(\.|$)/i.test(f))
  seen.set(name, { version: p.version, license: lic, text: file ? readFileSync(join(dir, file), 'utf8').trim() : '', homepage: p.homepage ?? p.repository?.url ?? '' })
  for (const dep of Object.keys(p.dependencies ?? {})) visit(dep, dir)
}
// derlemeye gomulen paketler: kaynaklarda import edilen tum bare paketler (devDependencies icinde olsalar bile)
function scan(dir, acc) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f)
    if (f === 'node_modules' || f === 'dist' || f.startsWith('.')) continue
    if (statSync(p).isDirectory()) scan(p, acc)
    else if (/\.(ts|tsx|mjs)$/.test(f) && !/\.test\./.test(f)) for (const m of readFileSync(p, 'utf8').matchAll(/from\s+'((?:@[\w.-]+\/)?\w[\w.-]*)(?:\/[^']*)?'/g)) if (!m[1].startsWith('node:') && m[1] !== 'electron' && !/^(vitest|esbuild|vite)$/.test(m[1])) acc.add(m[1])
  }
}
const used = new Set(Object.keys(pkg.dependencies ?? {}))
for (const d of ['src', 'packages']) if (existsSync(join(root, d))) scan(join(root, d), used)
for (const dep of [...used].sort()) visit(dep, root)
const names = [...seen.keys()].sort()
const out = ['# Third-party notices', '', 'Izlix is licensed under Apache-2.0 (see LICENSE). It bundles the open-source components below.', 'The Izlix Browser bundle additionally contains ungoogled-chromium / Chromium and their dependencies; see the `licenses` and `credits` pages shipped inside that bundle and https://github.com/ungoogled-software.', '', '## Runtime dependencies', '']
for (const n of names) { const e = seen.get(n); out.push(`- **${n}** ${e.version} (${e.license})${e.homepage ? ' ' + String(e.homepage).replace(/^git\+/, '') : ''}`) }
out.push('', '## License texts', '')
const groups = new Map()
for (const n of names) { const e = seen.get(n); const k = e.text || `(${e.license})`; groups.set(k, [...(groups.get(k) ?? []), `${n}@${e.version}`]) }
for (const [text, pk] of groups) { out.push(`### ${pk.join(', ')}`, '', '```', text, '```', '') }
console.log(out.join('\n'))
