// Meta/SEO degerlendirmesi: saf mantik.
export interface SeoData {
  url: string; title: string; description: string | null; canonical: string | null; robots: string | null; viewport: string | null; lang: string | null; charset: string
  og: Record<string, string>; twitter: Record<string, string>; jsonld: { type: string; ok: boolean }[]; h1: string[]; icon: boolean
  links: { total: number; internal: number; external: number; nofollow: number }; images: { total: number; noAlt: number }
}
export interface SeoIssue { id: string; sev: 'error' | 'warn' | 'ok'; detail?: string }

export function evaluateSeo(d: SeoData): SeoIssue[] {
  const out: SeoIssue[] = []
  const add = (id: string, sev: SeoIssue['sev'], detail?: string): void => { out.push({ id, sev, detail }) }
  const t = d.title.trim()
  if (!t) add('title.missing', 'error'); else if (t.length < 10) add('title.short', 'warn', `${t.length}`); else if (t.length > 60) add('title.long', 'warn', `${t.length}`); else add('title.ok', 'ok', `${t.length}`)
  const desc = (d.description ?? '').trim()
  if (d.description === null || !desc) add('desc.missing', 'warn'); else if (desc.length < 50) add('desc.short', 'warn', `${desc.length}`); else if (desc.length > 160) add('desc.long', 'warn', `${desc.length}`); else add('desc.ok', 'ok', `${desc.length}`)
  if (!d.canonical) add('canonical.missing', 'warn'); else add('canonical.ok', 'ok')
  if (d.robots && /noindex/i.test(d.robots)) add('robots.noindex', 'warn', d.robots)
  if (!d.lang) add('lang.missing', 'error'); else add('lang.ok', 'ok', d.lang)
  if (!d.viewport) add('viewport.missing', 'error'); else add('viewport.ok', 'ok')
  if (d.h1.length === 0) add('h1.missing', 'warn'); else if (d.h1.length > 1) add('h1.multiple', 'warn', `${d.h1.length}`); else add('h1.ok', 'ok')
  for (const k of ['og:title', 'og:description', 'og:image']) if (!d.og[k]) add(`og.${k.slice(3)}.missing`, 'warn')
  if (d.og['og:title'] && d.og['og:description'] && d.og['og:image']) add('og.ok', 'ok')
  if (!d.twitter['twitter:card']) add('twitter.missing', 'warn')
  if (d.jsonld.some((j) => !j.ok)) add('jsonld.invalid', 'error')
  if (!d.icon) add('icon.missing', 'warn')
  if (d.images.noAlt > 0) add('img.alt', 'warn', `${d.images.noAlt}/${d.images.total}`)
  return out
}

export const scoreOf = (issues: SeoIssue[]): number => {
  const e = issues.filter((i) => i.sev === 'error').length, w = issues.filter((i) => i.sev === 'warn').length
  return Math.max(0, 100 - e * 15 - w * 5)
}
