// Adres cubugu site kisayollari: "yt kedi" -> YouTube'da ara (saf). %s yer tutucusu kodlanmis sorguyla degisir.
export interface Shortcut { key: string; url: string; label?: string }
export const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'yt', label: 'YouTube', url: 'https://www.youtube.com/results?search_query=%s' },
  { key: 'gh', label: 'GitHub', url: 'https://github.com/search?q=%s' },
  { key: 'npm', label: 'npm', url: 'https://www.npmjs.com/search?q=%s' },
  { key: 'mdn', label: 'MDN', url: 'https://developer.mozilla.org/en-US/search?q=%s' },
  { key: 'so', label: 'Stack Overflow', url: 'https://stackoverflow.com/search?q=%s' },
  { key: 'wiki', label: 'Wikipedia', url: 'https://en.wikipedia.org/w/index.php?search=%s' },
  { key: 'vikipedi', label: 'Vikipedi', url: 'https://tr.wikipedia.org/w/index.php?search=%s' },
  { key: 'maps', label: 'Google Maps', url: 'https://www.google.com/maps/search/%s' },
  { key: 'img', label: 'Google Images', url: 'https://www.google.com/search?tbm=isch&q=%s' },
  { key: 'tr', label: 'Google Translate', url: 'https://translate.google.com/?sl=auto&tl=tr&text=%s' },
  { key: 'eksi', label: 'Ekşi Sözlük', url: 'https://eksisozluk.com/?q=%s' },
  { key: 'hb', label: 'Hepsiburada', url: 'https://www.hepsiburada.com/ara?q=%s' },
  { key: 'ty', label: 'Trendyol', url: 'https://www.trendyol.com/sr?q=%s' },
  { key: 'sahibinden', label: 'Sahibinden', url: 'https://www.sahibinden.com/arama?query_text=%s' }
]
const isHttpTemplate = (u: string): boolean => /^https?:\/\/[^\s]+$/i.test(u) && u.includes('%s')
/** Kullanici kisayollari varsayilanlarin ustune biner (ayni anahtar: kullanicininki). Gecersiz sablonlar atilir. */
export function mergeShortcuts(user: Shortcut[] | undefined): Shortcut[] {
  const m = new Map(DEFAULT_SHORTCUTS.map((s) => [s.key, s]))
  for (const s of user ?? []) if (/^[a-z0-9][a-z0-9._-]{0,15}$/i.test(s.key) && isHttpTemplate(s.url)) m.set(s.key.toLowerCase(), { key: s.key.toLowerCase(), url: s.url, label: s.label })
  return [...m.values()]
}
/** "<anahtar> <sorgu>" biciminde ise hedef URL'yi ve eslesen kisayolu doner; degilse null. GitHub (owner/repo) ve npm (paket) icin dogrudan sayfa. */
export function resolveShortcut(input: string, list: Shortcut[]): { url: string; shortcut: Shortcut; query: string } | null {
  const m = /^(\S+)\s+(.+)$/.exec(input.trim()); if (!m) return null
  const sc = list.find((s) => s.key === m[1].toLowerCase()); if (!sc) return null
  const q = m[2].trim(); if (!q) return null
  if (sc.key === 'gh' && /^[\w.-]+\/[\w.-]+$/.test(q)) return { url: `https://github.com/${q}`, shortcut: sc, query: q }
  if (sc.key === 'npm' && /^(@[\w.-]+\/)?[\w.-]+$/.test(q)) return { url: `https://www.npmjs.com/package/${q}`, shortcut: sc, query: q }
  return { url: sc.url.replace('%s', encodeURIComponent(q)), shortcut: sc, query: q }
}
