// Erisilebilirlik agaci (CDP Accessibility.getFullAXTree): agac kurma, gurultu budama, sorun isaretleme. Saf mantik.
export interface AxRaw { nodeId: string; ignored?: boolean; role?: { value?: string }; name?: { value?: string }; value?: { value?: unknown }; properties?: { name: string; value: { value?: unknown } }[]; childIds?: string[]; parentId?: string; backendDOMNodeId?: number }
export type AxIssue = 'noName' | 'emptyHeading' | 'levelJump' | 'multiMain'
export interface AxNode { id: string; role: string; name: string; props: Record<string, string>; backendId?: number; children: AxNode[]; issue?: AxIssue }

export const INTERACTIVE = new Set(['button', 'link', 'textbox', 'checkbox', 'radio', 'combobox', 'switch', 'slider', 'tab', 'menuitem', 'searchbox', 'spinbutton', 'option', 'listbox'])
export const LANDMARKS = new Set(['banner', 'navigation', 'main', 'complementary', 'contentinfo', 'search', 'form', 'region'])
const NOISE = new Set(['none', 'generic', 'InlineTextBox', 'LineBreak', 'presentation'])
const SHOW_PROPS = new Set(['level', 'checked', 'expanded', 'disabled', 'required', 'focusable', 'selected', 'pressed', 'invalid', 'url', 'haspopup'])

const text = (v: unknown): string => (v == null ? '' : String(v))

/** Duz dugum listesinden agac: yok sayilan/gurultu dugumlerinin cocuklari ust dugume tasinir; ayni metni tekrarlayan StaticText atilir. */
export function buildAxTree(raw: AxRaw[]): AxNode | null {
  if (!raw.length) return null
  const byId = new Map(raw.map((n) => [n.nodeId, n]))
  const root = raw.find((n) => !n.parentId || !byId.has(n.parentId)) ?? raw[0]
  const conv = (n: AxRaw, parent?: AxNode): AxNode[] => {
    const role = text(n.role?.value), name = text(n.name?.value).trim()
    const kids = (n.childIds ?? []).map((c) => byId.get(c)).filter((x): x is AxRaw => !!x)
    if (n.ignored || NOISE.has(role) || (role === 'StaticText' && parent && (parent.name === name || !name))) return kids.flatMap((k) => conv(k, parent))
    const props: Record<string, string> = {}
    for (const p of n.properties ?? []) if (SHOW_PROPS.has(p.name) && p.value?.value !== undefined && p.value.value !== false) props[p.name] = String(p.value.value)
    const node: AxNode = { id: n.nodeId, role: role || 'unknown', name, props, backendId: n.backendDOMNodeId, children: [] }
    node.children = kids.flatMap((k) => conv(k, node))
    return [node]
  }
  const top = conv(root)
  if (top.length === 1) return top[0]
  return { id: 'virtual-root', role: 'document', name: '', props: {}, children: top }
}

/** Sorunlari isaretler: adsiz etkilesimli oge/gorsel, bos baslik, baslik seviyesi atlamasi, birden fazla main. Isaretlenen sayisini dondurur. */
export function markIssues(root: AxNode): number {
  let n = 0, prevLevel = 0, mains = 0
  const walk = (a: AxNode): void => {
    if (a.role === 'main') mains++
    if ((INTERACTIVE.has(a.role) || a.role === 'img' || a.role === 'image') && !a.name) { a.issue = 'noName'; n++ }
    else if (a.role === 'heading') {
      const lv = Number(a.props.level) || 0
      if (!a.name) { a.issue = 'emptyHeading'; n++ }
      else if (prevLevel && lv > prevLevel + 1) { a.issue = 'levelJump'; n++ }
      if (lv) prevLevel = lv
    }
    a.children.forEach(walk)
  }
  walk(root)
  if (mains > 1) { const w = (a: AxNode): void => { if (a.role === 'main' && !a.issue) { a.issue = 'multiMain'; n++ } a.children.forEach(w) }; w(root) }
  return n
}

export interface AxSummary { nodes: number; landmarks: number; headings: number; interactive: number; issues: number }
export function summarizeAx(root: AxNode | null): AxSummary {
  const s: AxSummary = { nodes: 0, landmarks: 0, headings: 0, interactive: 0, issues: 0 }
  const walk = (a: AxNode): void => { s.nodes++; if (LANDMARKS.has(a.role)) s.landmarks++; if (a.role === 'heading') s.headings++; if (INTERACTIVE.has(a.role)) s.interactive++; if (a.issue) s.issues++; a.children.forEach(walk) }
  if (root) walk(root)
  return s
}

export interface AxRow { node: AxNode; depth: number; hasKids: boolean }
/** Duz satir listesi: daraltilmis dugumlerin cocuklari gizlenir; filtre varsa yalnizca eslesenler (yol bilgisi icin derinlik korunur). */
export function flattenAx(root: AxNode, collapsed: Set<string>, opts: { q?: string; onlyIssues?: boolean } = {}): AxRow[] {
  const q = (opts.q ?? '').trim().toLowerCase(), out: AxRow[] = []
  if (q || opts.onlyIssues) {
    const walk = (a: AxNode, d: number): void => {
      if ((!opts.onlyIssues || a.issue) && (!q || a.role.toLowerCase().includes(q) || a.name.toLowerCase().includes(q))) out.push({ node: a, depth: Math.min(d, 6), hasKids: false })
      a.children.forEach((c) => walk(c, d + 1))
    }
    walk(root, 0); return out
  }
  const walk = (a: AxNode, d: number): void => { out.push({ node: a, depth: d, hasKids: a.children.length > 0 }); if (!collapsed.has(a.id)) a.children.forEach((c) => walk(c, d + 1)) }
  walk(root, 0); return out
}
