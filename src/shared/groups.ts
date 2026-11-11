// Sekme gruplari (saf): renkler ve siralama kurali.
export const GROUP_COLORS: Record<string, string> = { grey: '#9aa0a6', blue: '#5b9dff', red: '#ff6b6b', yellow: '#f5c542', green: '#4fd18b', pink: '#ff7eb6', purple: '#b18cff', cyan: '#4dd0e1', orange: '#ff9a4d' }
export const GROUP_COLOR_NAMES = Object.keys(GROUP_COLORS)
export interface TabGroup { id: string; name: string; color: string; collapsed?: boolean }

/** Sabitlenmis sekmeler basta, sonra her grubun sekmeleri bitisik (grubun ilk sekmesinin yerinde), goreli sira korunur. */
export function normalizeOrder(order: string[], groupOf: (id: string) => string | undefined, pinned: (id: string) => boolean): string[] {
  const pins = order.filter((i) => pinned(i)), rest = order.filter((i) => !pinned(i))
  const out: string[] = [], placed = new Set<string>()
  for (const id of rest) {
    if (placed.has(id)) continue
    const g = groupOf(id)
    if (!g) { out.push(id); placed.add(id); continue }
    for (const x of rest) if (groupOf(x) === g && !placed.has(x)) { out.push(x); placed.add(x) }
  }
  return [...pins, ...out]
}
