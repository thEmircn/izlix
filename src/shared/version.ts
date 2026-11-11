/** "45.2.3" -> [45,2,3]; bozuksa null */
export function parseVer(v: string): [number, number, number] | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)/.exec(v.trim()); return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null
}
/** a, b'den KESIN eski mi */
export function isOlder(a: string, b: string): boolean {
  const x = parseVer(a), y = parseVer(b); if (!x || !y) return false
  for (let i = 0; i < 3; i++) { if (x[i] !== y[i]) return x[i] < y[i] }
  return false
}

/** "0.1.0-alpha.2" -> { core: [0,1,0], pre: ['alpha', 2] } (on-surum yoksa pre bos) */
function parseFull(v: string): { core: [number, number, number]; pre: (string | number)[] } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?/.exec(v.trim()); if (!m) return null
  return { core: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ? m[4].split('.').map((x) => (/^\d+$/.test(x) ? Number(x) : x)) : [] }
}

/** Semver siralamasi (on-surum dahil): -1, 0, 1; ayristirilamazsa null. Surum, ayni cekirdegin on-surumunden BUYUKTUR. */
export function compareVersions(a: string, b: string): -1 | 0 | 1 | null {
  const x = parseFull(a), y = parseFull(b); if (!x || !y) return null
  for (let i = 0; i < 3; i++) if (x.core[i] !== y.core[i]) return x.core[i] < y.core[i] ? -1 : 1
  if (!x.pre.length && !y.pre.length) return 0
  if (!x.pre.length) return 1
  if (!y.pre.length) return -1
  for (let i = 0; i < Math.max(x.pre.length, y.pre.length); i++) {
    const p = x.pre[i], q = y.pre[i]
    if (p === undefined) return -1
    if (q === undefined) return 1
    if (p === q) continue
    if (typeof p === 'number' && typeof q === 'number') return p < q ? -1 : 1
    if (typeof p === 'number') return -1
    if (typeof q === 'number') return 1
    return p < q ? -1 : 1
  }
  return 0
}

/** GitHub release listesinden (etiket adlari) verilen onekteki en yeni surum ("ext-v") ve etiketi; yoksa null */
export function latestTagged(tags: string[], prefix: string): { version: string; tag: string } | null {
  let best: { version: string; tag: string } | null = null
  for (const tag of tags) {
    if (!tag.startsWith(prefix)) continue
    const version = tag.slice(prefix.length)
    if (!parseFull(version)) continue
    if (!best || compareVersions(version, best.version) === 1) best = { version, tag }
  }
  return best
}
