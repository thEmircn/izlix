import type { Language } from '../shared/events'

const esc = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

const TEXT = {
  en: { title: "Can't reach this page", retry: 'Retrying automatically until the server starts…', servers: 'Dev servers running now:', code: 'Error' },
  tr: { title: 'Bu sayfaya ulaşılamıyor', retry: 'Sunucu başlayana kadar otomatik yeniden deneniyor…', servers: 'Şu an çalışan dev sunucuları:', code: 'Hata' }
}

/** Basarisiz yukleme icin sayfa govdesi (satir ici HTML; sayfa verisi kacirilir). */
export function errorPageHtml(url: string, code: number, desc: string, ports: number[], lang: Language, retrying: boolean): string {
  const t = TEXT[lang] ?? TEXT.en
  const links = ports.map((p) => `<a href="http://localhost:${p}/">localhost:${p}</a>`).join(' · ')
  return `<style>body{font:15px -apple-system,sans-serif;margin:12vh auto;max-width:560px;color:#ddd;background:#1c1c1e}h1{font-size:20px}code{color:#9aa}a{color:#4ea1ff}</style>`
    + `<h1>${esc(t.title)}</h1><p><code>${esc(url)}</code></p><p>${esc(t.code)}: ${esc(desc)} (${code})</p>`
    + (retrying ? `<p>${esc(t.retry)}</p>` : '') + (links ? `<p>${esc(t.servers)} ${links}</p>` : '')
}

export const shouldRetry = (url: string, isLoopback: (h: string) => boolean): boolean => {
  try { const u = new URL(url); return /^https?:$/.test(u.protocol) && isLoopback(u.hostname) } catch { return false }
}
