// Parola olusturucu ve guc/sizinti yardimcilari (saf; rastgelelik enjekte edilir).
export interface GenOpts { length?: number; upper?: boolean; lower?: boolean; digits?: boolean; symbols?: boolean; avoidAmbiguous?: boolean }
const SETS = { lower: 'abcdefghijkmnopqrstuvwxyz', upper: 'ABCDEFGHJKLMNPQRSTUVWXYZ', digits: '23456789', symbols: '!@#$%^&*-_=+?' }
const AMBIG = { lower: 'abcdefghijklmnopqrstuvwxyz', upper: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ', digits: '0123456789' }
/** rng: 0..max-1 araliginda tamsayi (varsayilan: kriptografik). Secili her sinif en az bir kez bulunur. */
export function generatePassword(o: GenOpts = {}, rng: (max: number) => number = cryptoInt): string {
  const len = Math.min(128, Math.max(8, Math.round(o.length ?? 20)))
  const on = { lower: o.lower !== false, upper: o.upper !== false, digits: o.digits !== false, symbols: o.symbols !== false }
  const pools: string[] = []
  for (const k of ['lower', 'upper', 'digits', 'symbols'] as const) if (on[k]) pools.push(o.avoidAmbiguous === false && k !== 'symbols' ? AMBIG[k] : SETS[k])
  if (!pools.length) pools.push(SETS.lower)
  const all = pools.join('')
  const chars = pools.map((p) => p[rng(p.length)])
  while (chars.length < len) chars.push(all[rng(all.length)])
  for (let i = chars.length - 1; i > 0; i--) { const j = rng(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]] } // Fisher-Yates
  return chars.join('')
}
function cryptoInt(max: number): number {
  const lim = Math.floor(0x100000000 / max) * max, b = new Uint32Array(1)
  do { crypto.getRandomValues(b) } while (b[0] >= lim) // modulo yanliligi yok
  return b[0] % max
}
/** Basit guc tahmini (bit): sinif cesitliligi x uzunluk; yaygin zayif oruntuler cezali */
export function strengthBits(pw: string): number {
  if (!pw) return 0
  let pool = 0
  if (/[a-z]/.test(pw)) pool += 26; if (/[A-Z]/.test(pw)) pool += 26; if (/\d/.test(pw)) pool += 10; if (/[^A-Za-z0-9]/.test(pw)) pool += 32
  let bits = pw.length * Math.log2(Math.max(pool, 2))
  if (/(.)\1{2,}/.test(pw)) bits *= 0.7
  if (/^(?:0123|1234|abcd|qwer|asdf|pass|sifre|parola|admin|letmein|welcome)/i.test(pw) || /(?:1234|abcd|qwer|password|parola|sifre)/i.test(pw)) bits *= 0.5
  if (new Set(pw).size <= Math.ceil(pw.length / 3)) bits *= 0.6
  return Math.round(bits)
}
export const isWeak = (pw: string): boolean => strengthBits(pw) < 45
/** HIBP aralik yaniti ("SUFFIX:COUNT" satirlari) icinden sonek eslesme sayisi */
export function parseRange(text: string, suffix: string): number {
  const s = suffix.toUpperCase()
  for (const line of text.split(/\r?\n/)) { const [h, c] = line.trim().split(':'); if (h === s) return Number(c) || 0 }
  return 0
}
