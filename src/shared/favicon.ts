// Favicon ve onizleme yardimcilari (saf). Anahtar: loopback adresleri tek "localhost" kimligine indirgenir.
const LOOP = new Set(['localhost', '127.0.0.1', '[::1]', '0.0.0.0'])
export const MAX_ICON_BYTES = 60_000

/** URL'nin kaynak anahtari (protokol//host[:port]); loopback hostlari "localhost" olur. Gecersizse null. */
export function originKey(url: string): string | null {
  try {
    const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    const host = LOOP.has(u.hostname) ? 'localhost' : u.hostname
    return `${u.protocol}//${host}${u.port ? `:${u.port}` : ''}`
  } catch { return null }
}

/** Onizleme anahtari: hash'siz tam adres (kisaltilmis). */
export function thumbKey(url: string): string | null {
  const o = originKey(url); if (!o) return null
  try { const u = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(url) ? url : `http://${url}`); return (o + u.pathname + u.search).slice(0, 400) } catch { return null }
}

export const isLoopbackOrigin = (key: string): boolean => key.startsWith('http://localhost')

const MIME = /^image\/(png|x-icon|vnd\.microsoft\.icon|jpeg|gif|webp|svg\+xml|avif)$/
/** Gelen yanittan guvenli bir ikon MIME'i cikarir; uygun degilse null. */
export function iconMime(contentType: string | null | undefined, url: string, bytes: number): string | null {
  if (bytes < 1 || bytes > MAX_ICON_BYTES) return null
  const ct = (contentType ?? '').split(';')[0].trim().toLowerCase()
  if (MIME.test(ct)) return ct
  if ((ct === '' || ct === 'application/octet-stream') && /\.ico(\?|$)/i.test(url)) return 'image/x-icon'
  return null
}

/** HTML'deki <link rel="icon"> adaylari (mutlak URL'ye cozulmus); apple-touch-icon en sonda. */
export function parseIconLinks(html: string, base: string): string[] {
  const out: { u: string; w: number }[] = []
  for (const m of html.slice(0, 200_000).matchAll(/<link\b[^>]*>/gi)) {
    const tag = m[0], rel = /\brel\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]?.toLowerCase() ?? '', href = /\bhref\s*=\s*["']([^"']*)["']/i.exec(tag)?.[1]
    if (!href || !/(^|\s)(shortcut\s+)?icon(\s|$)|apple-touch-icon/.test(rel)) continue
    try { const u = new URL(href, base).toString(); if (/^https?:/.test(u)) out.push({ u, w: rel.includes('apple') ? 1 : 0 }) } catch { /* bozuk href */ }
  }
  return out.sort((a, b) => a.w - b.w).map((x) => x.u)
}
