// Baglanti ve gorsel denetim sonuclarinin degerlendirilmesi (saf mantik).
export interface LinkResult { url: string; status: number }
export const brokenLinks = (r: LinkResult[]): LinkResult[] => r.filter((x) => x.status === 0 || x.status >= 400).sort((a, b) => b.status - a.status)

export interface ImgRow { src: string; nw: number; nh: number; dw: number; dh: number; bytes: number; lazy: boolean; inView: boolean; hasDims: boolean; dpr: number }
export interface ImgIssue { src: string; issues: ('oversized' | 'heavy' | 'no-lazy' | 'no-dims' | 'broken')[]; wasteKb: number; row: ImgRow }

/** Sorunlar: gereğinden buyuk (dogal > 2x goruntulenen*dpr), agir (> 200 kB), ekran disi ama lazy degil, boyutsuz (CLS), kirik (dogal boyut 0). */
export function auditImages(rows: ImgRow[]): ImgIssue[] {
  const out: ImgIssue[] = []
  for (const r of rows) {
    if (r.src.startsWith('data:')) continue
    const issues: ImgIssue['issues'] = []
    if (r.nw === 0 && r.nh === 0) issues.push('broken')
    else {
      if (r.dw > 0 && r.nw > r.dw * r.dpr * 2) issues.push('oversized')
      if (r.bytes > 200 * 1024) issues.push('heavy')
      if (!r.inView && !r.lazy && r.dw > 0) issues.push('no-lazy')
      if (!r.hasDims) issues.push('no-dims')
    }
    if (!issues.length) continue
    const ratio = r.dw > 0 && r.nw > 0 ? Math.min(1, (r.dw * r.dpr) / r.nw) : 1
    out.push({ src: r.src, issues, wasteKb: issues.includes('oversized') ? Math.round((r.bytes * (1 - ratio * ratio)) / 1024) : 0, row: r })
  }
  return out.sort((a, b) => b.wasteKb - a.wasteKb || b.issues.length - a.issues.length)
}
