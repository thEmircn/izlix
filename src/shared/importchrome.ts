// Chrome profilinden iceri aktarma: saf ayristiricilar.
export interface ImpBookmark { url: string; title: string }
interface Node { type?: string; url?: string; name?: string; children?: Node[] }

/** Chrome "Bookmarks" JSON'u -> duz liste (yalnizca http/https) */
export function parseChromeBookmarks(json: unknown): ImpBookmark[] {
  const out: ImpBookmark[] = [], seen = new Set<string>()
  const walk = (n: Node | undefined): void => {
    if (!n) return
    if (n.type === 'url' && typeof n.url === 'string' && /^https?:\/\//.test(n.url) && !seen.has(n.url)) { seen.add(n.url); out.push({ url: n.url, title: String(n.name ?? n.url) }) }
    for (const c of n.children ?? []) walk(c)
  }
  const roots = (json as { roots?: Record<string, Node> } | null)?.roots
  if (roots && typeof roots === 'object') for (const k of Object.keys(roots)) if (roots[k] && typeof roots[k] === 'object') walk(roots[k])
  return out
}
/** Chrome zamani (1601'den beri mikrosaniye) -> epoch ms */
export const chromeTimeToMs = (t: number): number => Math.round(t / 1000 - 11_644_473_600_000)
