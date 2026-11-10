/** Basit bulanık eşleştirme: sorgunun harfleri sırayla geçmeli. Skor büyük = daha iyi; null = eşleşmedi. */
export function fuzzyScore(query: string, text: string): number | null {
  const q = query.toLowerCase().trim()
  if (!q) return 0
  const t = text.toLowerCase()
  const idx = t.indexOf(q)
  if (idx >= 0) return 1000 - idx - (t.length - q.length) * 0.1 + (idx === 0 || t[idx - 1] === ' ' ? 50 : 0)
  let score = 0, ti = 0, prev = -2
  for (const ch of q) {
    const at = t.indexOf(ch, ti)
    if (at < 0) return null
    score += at === prev + 1 ? 8 : 1
    if (at === 0 || t[at - 1] === ' ' || t[at - 1] === ':') score += 4
    prev = at; ti = at + 1
  }
  return score
}

export function rank<T>(items: T[], query: string, text: (i: T) => string, limit = 50): T[] {
  if (!query.trim()) return items.slice(0, limit)
  const scored: [number, T][] = []
  for (const it of items) { const s = fuzzyScore(query, text(it)); if (s !== null) scored.push([s, it]) }
  return scored.sort((a, b) => b[0] - a[0]).slice(0, limit).map((x) => x[1])
}
