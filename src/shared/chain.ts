import type { BusEvent, Certainty } from './events'

export interface ChainStep { ev: BusEvent; via?: { type: string; certainty: Certainty }; dtMs?: number }

/** Secili olaydan kok nedene dogru ilk-bag zinciri; kok -> secili sirasinda. Dongu ve asiri uzunluga karsi korumali. */
export function causeChain(byId: Map<number, BusEvent>, id: number, max = 12): ChainStep[] {
  const steps: ChainStep[] = []
  const seen = new Set<number>()
  let cur = byId.get(id)
  while (cur && !seen.has(cur.id) && steps.length < max) {
    seen.add(cur.id)
    const link = cur.links.find((l) => byId.has(l.from) && !seen.has(l.from)) // kesin baglar once gelir (bus.link sirasi)
    const exact = cur.links.find((l) => l.certainty === 'exact' && byId.has(l.from) && !seen.has(l.from))
    const pick = exact ?? link
    steps.push({ ev: cur, via: pick ? { type: pick.type, certainty: pick.certainty } : undefined })
    cur = pick ? byId.get(pick.from) : undefined
  }
  steps.reverse()
  // ters cevrildi: kok -> ... -> secili. Her adimin `via`si onu bir onceki adima (nedenine) baglayan bagdir.
  return steps.map((s, i) => ({ ev: s.ev, via: i === 0 ? undefined : s.via, dtMs: i === 0 ? undefined : Math.round(s.ev.ts - steps[i - 1].ev.ts) }))
}

/** Secili olayin dogrudan sonuclari (ona bag veren olaylar), zamana gore */
export function effectsOf(events: Iterable<BusEvent>, id: number): { ev: BusEvent; certainty: Certainty; type: string }[] {
  const out: { ev: BusEvent; certainty: Certainty; type: string }[] = []
  for (const e of events) for (const l of e.links) if (l.from === id) out.push({ ev: e, certainty: l.certainty, type: l.type })
  return out.sort((a, b) => a.ev.ts - b.ev.ts)
}

/** Son sayfa gezinmesinden (frameNavigated) itibaren olaylar — "log'u koru" kapaliyken Network/Console bunu gosterir */
export function sinceNavigation(events: BusEvent[]): BusEvent[] {
  let from = -1
  for (let i = events.length - 1; i >= 0; i--) if (events[i].kind === 'navigation' && events[i].source === 'cdp:Page.frameNavigated') { from = i; break }
  return from < 0 ? events : events.slice(from)
}
