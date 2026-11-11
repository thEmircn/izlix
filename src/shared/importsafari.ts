// Safari yer imi (plutil ile JSON'a cevrilmis Bookmarks.plist) ayristirici ve zaman cevirici (saf).
import type { ImpBookmark } from './importchrome'
interface SNode { WebBookmarkType?: string; URLString?: string; URIDictionary?: { title?: string }; Title?: string; Children?: SNode[] }

export function parseSafariBookmarks(json: unknown): ImpBookmark[] {
  const out: ImpBookmark[] = [], seen = new Set<string>()
  const walk = (n: SNode | undefined): void => {
    if (!n || typeof n !== 'object') return
    if (n.WebBookmarkType === 'WebBookmarkTypeLeaf' && typeof n.URLString === 'string' && /^https?:\/\//.test(n.URLString) && !seen.has(n.URLString)) {
      seen.add(n.URLString); out.push({ url: n.URLString, title: String(n.URIDictionary?.title ?? n.Title ?? n.URLString) })
    }
    for (const c of n.Children ?? []) walk(c)
  }
  walk(json as SNode)
  return out
}
/** Core Data zamani (2001-01-01'den beri saniye) -> epoch ms */
export const safariTimeToMs = (t: number): number => Math.round((t + 978_307_200) * 1000)
