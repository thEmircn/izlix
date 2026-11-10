// Elements paneli icin saf DOM agaci yardimcilari (CDP DOM.Node bicimi).
export interface DomNode {
  nodeId: number; backendNodeId?: number; nodeType: number; nodeName: string; localName?: string; nodeValue?: string
  childNodeCount?: number; children?: DomNode[]; attributes?: string[]; contentDocument?: DomNode; shadowRoots?: DomNode[]; pseudoType?: string
}

export interface DomRow { node: DomNode; depth: number; open: boolean; hasChildren: boolean; close: boolean }

const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'source', 'track', 'wbr'])
export const isVoid = (n: DomNode): boolean => VOID.has((n.localName ?? n.nodeName).toLowerCase())

/** Yeniden yuklemelerde kararli kimlik (CDP nodeId'leri getDocument'ta yeniden atanir) */
export const keyOf = (n: DomNode): number => n.backendNodeId ?? n.nodeId

export function findByKey(root: DomNode, key: number): DomNode | null {
  if (keyOf(root) === key) return root
  for (const c of kids(root)) { const r = findByKey(c, key); if (r) return r }
  return null
}

export const attrMap = (n: DomNode): Record<string, string> => { const o: Record<string, string> = {}; const a = n.attributes ?? []; for (let i = 0; i + 1 < a.length; i += 2) o[a[i]] = a[i + 1]; return o }

export function kids(n: DomNode): DomNode[] {
  const out: DomNode[] = []
  if (n.contentDocument) out.push(n.contentDocument)
  for (const c of n.shadowRoots ?? []) out.push(c)
  for (const c of n.children ?? []) {
    if (c.nodeType === 3 && !(c.nodeValue ?? '').trim()) continue // bosluk metinleri
    out.push(c)
  }
  return out
}

/** Varsayilan kapali dugumler: script/style/svg/noscript icerigi (gurultu) */
export function autoCollapsed(root: DomNode): Set<number> {
  const s = new Set<number>()
  const walk = (n: DomNode): void => { if (n.nodeType === 1 && ['script', 'style', 'svg', 'noscript', 'template'].includes((n.localName ?? '').toLowerCase())) s.add(keyOf(n)); for (const c of kids(n)) walk(c) }
  walk(root)
  return s
}

/** Agaci duz satir listesine cevirir (sanallastirma icin). `collapsed`: kapali dugum kimlikleri. Elemanlarin kapanis etiketi ayri satir olur. */
export function flatten(root: DomNode, collapsed: Set<number>, limit = 20000): DomRow[] {
  const rows: DomRow[] = []
  const walk = (n: DomNode, depth: number): void => {
    if (rows.length >= limit) return
    const k = kids(n)
    const hasChildren = k.length > 0
    const open = hasChildren && !collapsed.has(keyOf(n))
    rows.push({ node: n, depth, open, hasChildren, close: false })
    if (open) {
      for (const c of k) walk(c, depth + 1)
      if (n.nodeType === 1 && !isVoid(n)) rows.push({ node: n, depth, open: false, hasChildren: false, close: true })
    }
  }
  // belge dugumunun kendisi gosterilmez: kokler html/doctype
  for (const c of kids(root)) walk(c, 0)
  return rows
}

/** Dugume giden ata kimlikleri (acilmasi gerekenler) */
export function pathTo(root: DomNode, nodeId: number): number[] | null {
  const walk = (n: DomNode, path: number[]): number[] | null => {
    if (n.nodeId === nodeId) return path
    for (const c of kids(n)) { const r = walk(c, [...path, n.nodeId]); if (r) return r }
    return null
  }
  return walk(root, [])
}

export function findNode(root: DomNode, nodeId: number): DomNode | null {
  if (root.nodeId === nodeId) return root
  for (const c of kids(root)) { const r = findNode(c, nodeId); if (r) return r }
  return null
}

const esc = (s: string): string => s.replace(/[^\w-]/g, (c) => '\\' + c)
/** Dugum icin kisa, benzersize yakin CSS secici (id > tag.class > nth-of-type zinciri) */
export function selectorOf(root: DomNode, nodeId: number): string {
  const path = pathTo(root, nodeId)
  const target = findNode(root, nodeId)
  if (!path || !target) return ''
  const chain = [...path.map((id) => findNode(root, id)!), target].filter((n) => n.nodeType === 1)
  const parts: string[] = []
  for (let i = chain.length - 1; i >= 0; i--) {
    const n = chain[i], a = attrMap(n), tag = (n.localName ?? n.nodeName).toLowerCase()
    if (a.id) { parts.unshift(`#${esc(a.id)}`); break }
    const parent = chain[i - 1]
    let part = tag
    const cls = (a.class ?? '').split(/\s+/).filter(Boolean).slice(0, 2)
    if (cls.length) part += cls.map((c) => '.' + esc(c)).join('')
    if (parent) {
      const same = kids(parent).filter((s) => s.nodeType === 1 && (s.localName ?? '').toLowerCase() === tag)
      if (same.length > 1) part += `:nth-of-type(${same.indexOf(n) + 1})`
    }
    parts.unshift(part)
  }
  return parts.join(' > ')
}

export const nodeLabel = (n: DomNode): string => n.nodeType === 3 ? (n.nodeValue ?? '').trim() : n.nodeType === 8 ? `<!--${n.nodeValue ?? ''}-->` : n.nodeType === 10 ? `<!DOCTYPE ${n.nodeName}>` : n.nodeName.toLowerCase()
