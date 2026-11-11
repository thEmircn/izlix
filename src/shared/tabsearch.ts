// Tum sekmelerde arama (saf): eslesme sayisi ve ozet parcalari; Turkce buyuk/kucuk harf (I/i/İ/ı) farkina duyarsiz.
const fold = (s: string): string => s.toLocaleLowerCase('tr').replace(/i̇/g, 'i')
export interface Hit { count: number; snippets: string[] }

/** `text` icinde `q` gecislerini sayar; en fazla `max` ozet (eslesme +/- ctx karakter) doner */
export function searchText(text: string, q: string, max = 3, ctx = 44): Hit {
  const needle = fold(q.trim())
  if (!needle) return { count: 0, snippets: [] }
  const hay = fold(text.replace(/\s+/g, ' '))
  const flat = text.replace(/\s+/g, ' ')
  let count = 0; const snippets: string[] = []
  let i = hay.indexOf(needle)
  while (i >= 0) {
    count++
    if (snippets.length < max) {
      const from = Math.max(0, i - ctx), to = Math.min(flat.length, i + needle.length + ctx)
      snippets.push((from > 0 ? '…' : '') + flat.slice(from, to).trim() + (to < flat.length ? '…' : ''))
    }
    i = hay.indexOf(needle, i + needle.length)
    if (count > 9999) break
  }
  return { count, snippets }
}
export interface TabHit { id: string; title: string; url: string; count: number; snippets: string[]; titleMatch: boolean; sleeping?: boolean; private?: boolean }
/** Basliga/adrese gore eslesme (bos sorgu: hepsi); icerik eslesmeleriyle birlikte siralanir: icerik sayisi azalan, sonra baslik eslesmesi */
export function rankTabs(hits: TabHit[]): TabHit[] {
  return [...hits].sort((a, b) => b.count - a.count || Number(b.titleMatch) - Number(a.titleMatch) || a.title.localeCompare(b.title))
}
export const matchesTitle = (title: string, url: string, q: string): boolean => { const n = fold(q.trim()); return !n || fold(title).includes(n) || fold(url).includes(n) }
