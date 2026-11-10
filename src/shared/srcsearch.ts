// Sources: tum dosyalarda arama. Saf mantik.
export interface SearchFile { name: string; text: string }
export interface SearchHit { file: string; line: number; col: number; snippet: string }

/** Buyuk/kucuk harf duyarsiz alt dize aramasi; dosya basina ve toplam sinirli. Cok uzun (minify) satirlarda eslesme etrafi kesilir. */
export function searchFiles(files: SearchFile[], query: string, opts: { perFile?: number; total?: number } = {}): SearchHit[] {
  const q = query.trim().toLowerCase(), perFile = opts.perFile ?? 30, total = opts.total ?? 300
  if (q.length < 2) return []
  const out: SearchHit[] = []
  for (const f of files) {
    let n = 0
    const lines = f.text.split('\n')
    for (let i = 0; i < lines.length && n < perFile && out.length < total; i++) {
      const col = lines[i].toLowerCase().indexOf(q)
      if (col < 0) continue
      const ln = lines[i]
      const from = Math.max(0, col - 40), snippet = (from > 0 ? '…' : '') + ln.slice(from, col + q.length + 80).trim() + (ln.length > col + q.length + 80 ? '…' : '')
      out.push({ file: f.name, line: i + 1, col: col + 1, snippet }); n++
    }
    if (out.length >= total) break
  }
  return out
}

export const groupHits = (hits: SearchHit[]): { file: string; hits: SearchHit[] }[] => {
  const m = new Map<string, SearchHit[]>()
  for (const h of hits) { const a = m.get(h.file); if (a) a.push(h); else m.set(h.file, [h]) }
  return [...m.entries()].map(([file, hs]) => ({ file, hits: hs }))
}
