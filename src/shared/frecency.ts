// Komut paleti: sik ve yakin zamanda kullanilan komutlari one cikarir (saf mantik).
export type Usage = Record<string, { n: number; t: number }>
const HALF_LIFE_MS = 7 * 24 * 3600 * 1000

export function record(u: Usage, id: string, now = Date.now()): Usage {
  const e = u[id] ?? { n: 0, t: now }
  const out: Usage = { ...u, [id]: { n: e.n + 1, t: now } }
  const ids = Object.keys(out)
  if (ids.length > 200) { // en eskileri at
    for (const k of ids.sort((a, b) => out[a].t - out[b].t).slice(0, ids.length - 200)) delete out[k]
  }
  return out
}

/** Kullanim puani: sayi * zamanla azalan agirlik (yari omur 7 gun) */
export const score = (u: Usage, id: string, now = Date.now()): number => { const e = u[id]; return e ? e.n * Math.pow(0.5, (now - e.t) / HALF_LIFE_MS) : 0 }

/** Arama sonuclarini kullanim puanina gore (esit eslesmede) yeniden sirala; sorgu bossa kullanilanlar basa gelir. Sirayi bozmaz: yalniz puan farki olanlari one alir. */
export function boost<T extends { id: string }>(items: T[], u: Usage, query: string, now = Date.now()): T[] {
  const scored = items.map((it, i) => ({ it, i, s: score(u, it.id, now) }))
  if (!query.trim()) return scored.sort((a, b) => b.s - a.s || a.i - b.i).map((x) => x.it)
  // sorgu varken: eslesme sirasi korunur, yalnizca ilk 8 icinde kullanim puani yuksek olanlar one cikar
  const head = scored.slice(0, 8).sort((a, b) => (b.s > 0.5 ? b.s : 0) - (a.s > 0.5 ? a.s : 0) || a.i - b.i)
  return [...head, ...scored.slice(8)].map((x) => x.it)
}
