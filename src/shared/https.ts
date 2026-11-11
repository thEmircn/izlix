// HTTPS-only: http:// adreslerini https://'e yukseltme karari (saf).
const isIp = (h: string): boolean => /^\d{1,3}(\.\d{1,3}){3}$/.test(h) || h.includes(':') || h.startsWith('[')
/** Yukseltilecek adres ya da null (yerel/IP/tek etiketli/ozel port/.onion/.local vb. dokunulmaz) */
export function upgradeToHttps(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.protocol !== 'http:') return null
  const h = u.hostname.toLowerCase()
  if (!h || isIp(h) || !h.includes('.') || u.port) return null // tek etiketli (intranet), IP, acik port: yukseltme yok
  if (/\.(local|localhost|internal|lan|home|test|onion|invalid|example)$/.test(h) || h === 'localhost') return null
  u.protocol = 'https:'
  return u.toString()
}
