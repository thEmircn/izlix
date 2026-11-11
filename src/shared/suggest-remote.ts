// Arama motoru canli onerileri: motor basina uc nokta + yanit ayristirma (saf).
export const REMOTE_ENDPOINTS: Record<string, string> = {
  duckduckgo: 'https://duckduckgo.com/ac/?type=list&q=%s',
  google: 'https://suggestqueries.google.com/complete/search?client=firefox&q=%s',
  yandex: 'https://suggest.yandex.com/suggest-ff.cgi?part=%s',
  bing: 'https://api.bing.com/osjson.aspx?query=%s',
  brave: 'https://search.brave.com/api/suggest?q=%s'
}
export const remoteUrl = (engine: string, q: string): string | null => { const e = REMOTE_ENDPOINTS[engine]; return e ? e.replace('%s', encodeURIComponent(q)) : null }

/** OpenSearch ["q",["a","b"]] ya da DuckDuckGo [{phrase}] bicimlerini string listesine cevirir. */
export function parseRemote(json: unknown, limit = 6): string[] {
  let raw: unknown[] = []
  if (Array.isArray(json)) {
    if (Array.isArray(json[1])) raw = json[1] // OpenSearch
    else raw = json
  }
  const out: string[] = []
  for (const x of raw) {
    const s = typeof x === 'string' ? x : x && typeof x === 'object' && typeof (x as { phrase?: unknown }).phrase === 'string' ? (x as { phrase: string }).phrase : null
    if (s && s.length <= 120 && !out.includes(s)) out.push(s)
    if (out.length >= limit) break
  }
  return out
}
