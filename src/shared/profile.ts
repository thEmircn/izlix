// CPU profili (CDP Profiler.Profile) analizi: fonksiyon basina oz/toplam sure ve alev grafigi agaci. Saf mantik.
export interface CallFrame { functionName: string; url: string; lineNumber: number; columnNumber?: number; scriptId?: string }
export interface ProfNode { id: number; callFrame: CallFrame; hitCount?: number; children?: number[] }
export interface CpuProfile { nodes: ProfNode[]; startTime: number; endTime: number; samples?: number[]; timeDeltas?: number[] }

export interface FlameNode { id: number; name: string; url: string; line: number; self: number; total: number; depth: number; start: number; children: FlameNode[] }
export interface FnRow { key: string; name: string; url: string; line: number; self: number; total: number; hits: number }
export interface Analysis { totalMs: number; idleMs: number; rows: FnRow[]; flame: FlameNode | null; maxDepth: number }

const isIdle = (n: ProfNode): boolean => n.callFrame.functionName === '(idle)'
const label = (c: CallFrame): string => c.functionName || (c.url ? '(anonymous)' : '(program)')

/** ms cinsinden; her ornek, bir onceki ornekten itibaren gecen sureyi ilgili dugume yazar. */
export function analyzeProfile(p: CpuProfile): Analysis {
  const byId = new Map(p.nodes.map((n) => [n.id, n]))
  const self = new Map<number, number>()
  const samples = p.samples ?? [], deltas = p.timeDeltas ?? []
  const lastDur = Math.max(0, p.endTime - p.startTime - deltas.reduce((a, b) => a + b, 0)) // son ornek endTime'a kadar surer
  for (let i = 0; i < samples.length; i++) {
    const dt = (i + 1 < samples.length ? deltas[i + 1] ?? 0 : lastDur) / 1000 // bir sonraki delta bu ornegin suresi
    self.set(samples[i], (self.get(samples[i]) ?? 0) + dt)
  }
  if (!samples.length) for (const n of p.nodes) if (n.hitCount) self.set(n.id, n.hitCount) // ornek yoksa isabet sayisi (olcegi anlamsiz ama sirayi korur)
  // toplam: alt agaclarin toplami
  const total = new Map<number, number>()
  const sumTotal = (id: number): number => {
    if (total.has(id)) return total.get(id)!
    const n = byId.get(id)!
    let t = self.get(id) ?? 0
    for (const c of n.children ?? []) t += sumTotal(c)
    total.set(id, t); return t
  }
  const root = p.nodes[0]
  if (!root) return { totalMs: 0, idleMs: 0, rows: [], flame: null, maxDepth: 0 }
  sumTotal(root.id)
  let idleMs = 0
  for (const n of p.nodes) if (isIdle(n)) idleMs += self.get(n.id) ?? 0
  // fonksiyon bazinda topla (ayni fonksiyon farkli cagri yollarinda)
  const rows = new Map<string, FnRow>()
  for (const n of p.nodes) {
    const s = self.get(n.id) ?? 0
    if (isIdle(n) || (n.callFrame.functionName === '(root)')) continue
    const key = `${n.callFrame.functionName}|${n.callFrame.url}|${n.callFrame.lineNumber}`
    const r = rows.get(key) ?? { key, name: label(n.callFrame), url: n.callFrame.url, line: n.callFrame.lineNumber + 1, self: 0, total: 0, hits: 0 }
    r.self += s; r.hits += n.hitCount ?? 0
    rows.set(key, r)
  }
  // toplam sure: ozyineleme sayilmasin diye yalnizca bu fonksiyonun EN UST dugumlerinde topla
  const seenOnPath = new Set<string>()
  const walkTotal = (id: number): void => {
    const n = byId.get(id)!; const key = `${n.callFrame.functionName}|${n.callFrame.url}|${n.callFrame.lineNumber}`
    const first = !seenOnPath.has(key)
    if (first) { seenOnPath.add(key); const r = rows.get(key); if (r) r.total += total.get(id) ?? 0 }
    for (const c of n.children ?? []) walkTotal(c)
    if (first) seenOnPath.delete(key)
  }
  walkTotal(root.id)
  // alev agaci (idle atlanir)
  let maxDepth = 0
  const build = (id: number, depth: number, start: number): FlameNode | null => {
    const n = byId.get(id)!
    if (isIdle(n)) return null
    const t = total.get(id) ?? 0
    const node: FlameNode = { id, name: label(n.callFrame), url: n.callFrame.url, line: n.callFrame.lineNumber + 1, self: self.get(id) ?? 0, total: t, depth, start, children: [] }
    maxDepth = Math.max(maxDepth, depth)
    let off = start + node.self
    for (const c of (n.children ?? []).slice().sort((a, b) => (total.get(b) ?? 0) - (total.get(a) ?? 0))) { const ch = build(c, depth + 1, off); if (ch) { node.children.push(ch); off += ch.total } }
    return node
  }
  const flame = build(root.id, 0, 0)
  const totalMs = (total.get(root.id) ?? 0) - idleMs
  return { totalMs, idleMs, rows: [...rows.values()].filter((r) => r.self > 0 || r.total > 0).sort((a, b) => b.self - a.self), flame, maxDepth }
}
