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
