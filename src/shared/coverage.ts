// JS/CSS kapsama (coverage) hesabi: saf mantik.
export interface Range { startOffset: number; endOffset: number; count: number }
export interface FnCov { functionName?: string; ranges: Range[]; isBlockCoverage?: boolean }
export interface ScriptCov { scriptId: string; url: string; functions: FnCov[] }

/** Ic ice (nested) aralik listesinden [0, toplam) icinde calisan bayt sayisi. Aralik sirasi: dis -> ic (CDP sirasi). */
export function usedBytes(total: number, ranges: Range[]): number {
  if (total <= 0) return 0
  const rs = ranges.filter((r) => r.endOffset > r.startOffset).sort((a, b) => a.startOffset - b.startOffset || b.endOffset - a.endOffset)
  let used = 0, pos = 0
  const stack: Range[] = []
  const cnt = (): number => (stack.length ? stack[stack.length - 1].count : 0)
  const advance = (to: number): void => { if (to > pos) { if (cnt() > 0) used += Math.min(to, total) - Math.min(pos, total); pos = to } }
  for (const r of rs) {
    while (stack.length && stack[stack.length - 1].endOffset <= r.startOffset) { advance(stack[stack.length - 1].endOffset); stack.pop() }
    advance(r.startOffset)
    stack.push(r)
  }
  while (stack.length) { advance(stack[stack.length - 1].endOffset); stack.pop() }
  return Math.min(used, total)
}

export interface ScriptRow { url: string; total: number; used: number; unused: number; pct: number }

export function summarizeScripts(cov: ScriptCov[]): ScriptRow[] {
  const byUrl = new Map<string, ScriptRow>()
  for (const s of cov) {
    if (!s.url || /^(chrome|devtools|extensions?|about)/.test(s.url) || s.url.startsWith('data:')) continue
    const all = s.functions.flatMap((f) => f.ranges)
    const total = s.functions[0]?.ranges[0]?.endOffset ?? 0
    if (total <= 0) continue
    const used = usedBytes(total, all)
    const prev = byUrl.get(s.url)
    if (prev) { prev.total += total; prev.used += used } else byUrl.set(s.url, { url: s.url, total, used, unused: 0, pct: 0 })
  }
  return [...byUrl.values()].map((r) => ({ ...r, unused: r.total - r.used, pct: r.total ? Math.round((r.used / r.total) * 100) : 0 })).sort((a, b) => b.unused - a.unused)
}

export interface CssUsage { styleSheetId: string; startOffset: number; endOffset: number; used: boolean }
export function summarizeCss(rules: CssUsage[]): { rules: number; used: number; unused: number; pct: number; bytesUnused: number; bytesTotal: number } {
  const used = rules.filter((r) => r.used).length
  const bytesTotal = rules.reduce((a, r) => a + (r.endOffset - r.startOffset), 0)
  const bytesUnused = rules.filter((r) => !r.used).reduce((a, r) => a + (r.endOffset - r.startOffset), 0)
  return { rules: rules.length, used, unused: rules.length - used, pct: rules.length ? Math.round((used / rules.length) * 100) : 100, bytesUnused, bytesTotal }
}

/** Kullanilmayan kural metninden secici (ilk `{`e kadar) */
export const selectorOfRuleText = (text: string): string => text.split('{')[0].trim().replace(/\s+/g, ' ').slice(0, 120)

export interface CssRuleSnap { sel: string; used: boolean; url: string }
/** Anlik tarama (seciciyle eslesen oge var mi) + kayit sirasinda CDP'nin "kullanildi" dedigi secicilerin birlesimi */
export function mergeCss(snap: CssRuleSnap[], cdpUsedSelectors: Iterable<string>): { rules: number; unused: number; used: number; pct: number; unusedSelectors: { sel: string; url: string }[] } {
  const cdp = new Set(cdpUsedSelectors)
  const unusedList = snap.filter((r) => !r.used && !cdp.has(r.sel))
  const rules = snap.length, unused = unusedList.length
  return { rules, unused, used: rules - unused, pct: rules ? Math.round(((rules - unused) / rules) * 100) : 100, unusedSelectors: unusedList.map((r) => ({ sel: r.sel, url: r.url })) }
}
