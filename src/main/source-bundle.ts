export interface OrigSource { name: string; content: string | null }
export interface SourceBundle { url: string; code: string; mapUrl?: string; sources: OrigSource[]; truncated: boolean }

const MAX_CODE = 2_000_000, MAX_FILES = 120, MAX_FILE = 600_000

const cleanName = (n: string): string => { try { n = decodeURIComponent(n) } catch { /* ham */ } return n.replace(/^webpack:\/\/[^/]*\//, '').replace(/^file:\/\//, '').replace(/^turbopack:\/\/\/\[project\]\//, '').replace(/\?.*$/, '') }

/** Source map (duz veya bolumlu) -> orijinal dosya adlari ve gomulu icerikleri. */
export function parseMap(text: string): OrigSource[] {
  let j: any
  try { j = JSON.parse(text) } catch { return [] }
  const out: OrigSource[] = []
  const add = (m: any): void => {
    const root: string = m.sourceRoot ?? ''
    ;(m.sources ?? []).forEach((s: string, i: number) => out.push({ name: cleanName(root && !/^[a-z]+:/i.test(s) ? root.replace(/\/?$/, '/') + s : s), content: typeof m.sourcesContent?.[i] === 'string' ? m.sourcesContent[i] : null }))
  }
  if (Array.isArray(j.sections)) j.sections.forEach((sec: any) => sec?.map && add(sec.map)); else add(j)
  const seen = new Set<string>()
  return out.filter((o) => (seen.has(o.name) ? false : (seen.add(o.name), true)))
}

/** Betigi ve (varsa) source map'ini getirir; icerigi gomulu olmayan orijinal dosyalari haritanin yanindan indirmeyi dener. */
export async function loadBundle(fetchText: (u: string) => Promise<string | null>, url: string): Promise<SourceBundle> {
  const full = (await fetchText(url)) ?? ''
  const truncated = full.length > MAX_CODE
  const code = truncated ? full.slice(0, MAX_CODE) : full
  // son sourceMappingURL: satir ici (data:) haritalar yuzlerce KB olabilir, bu yuzden sabit uzunluklu sona bakilmaz
  const at = full.lastIndexOf('sourceMappingURL=')
  const tail = at >= 0 ? /^sourceMappingURL=(\S+?)(?:\s*\*\/)?\s*$/.exec(full.slice(at)) : null
  const ref = tail && /[\/*][#@] $/.test(full.slice(Math.max(0, at - 4), at)) || (tail && /[#@] $/.test(full.slice(Math.max(0, at - 4), at))) ? tail : null
  if (!ref) return { url, code, sources: [], truncated }
  let mapUrl: string
  try { mapUrl = new URL(ref[1], url).href } catch { return { url, code, sources: [], truncated } }
  let sources: OrigSource[] = []
  if (ref[1].startsWith('data:')) {
    const i = ref[1].indexOf(','); const body = ref[1].slice(i + 1)
    try { sources = parseMap(ref[1].slice(0, i).includes(';base64') ? Buffer.from(body, 'base64').toString('utf8') : decodeURIComponent(body)) } catch { /* bozuk */ }
    return { url, code, mapUrl: 'inline', sources: sources.slice(0, MAX_FILES).map((s) => ({ ...s, content: s.content && s.content.length > MAX_FILE ? s.content.slice(0, MAX_FILE) : s.content })), truncated }
  }
  const mapText = await fetchText(mapUrl)
  if (mapText) sources = parseMap(mapText)
  const out: OrigSource[] = []
  for (const s of sources.slice(0, MAX_FILES)) out.push({ name: s.name, content: s.content && s.content.length > MAX_FILE ? s.content.slice(0, MAX_FILE) : s.content })
  return { url, code, mapUrl, sources: out, truncated }
}
