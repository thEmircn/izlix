// Network Lab: GraphQL tanima ve iki istegi karsilastirma. Saf mantik.
export interface Gql { op: string | null; type: 'query' | 'mutation' | 'subscription' | null; query: string; variables?: unknown }

/** POST govdesi GraphQL istegi mi? (tekli istek; toplu dizi ilk eleman) */
export function parseGraphql(postData: string | undefined): Gql | null {
  if (!postData || postData.length > 2_000_000) return null
  let j: any
  try { j = JSON.parse(postData) } catch { return null }
  if (Array.isArray(j)) j = j[0]
  if (!j || typeof j !== 'object' || typeof j.query !== 'string') return null
  const m = j.query.match(/^\s*(query|mutation|subscription)?\s*([A-Za-z_][A-Za-z0-9_]*)?/)
  const type = (m?.[1] as Gql['type']) ?? (/^\s*\{/.test(j.query) ? 'query' : null)
  if (!type) return null
  return { op: (typeof j.operationName === 'string' && j.operationName) || m?.[2] || null, type, query: j.query, variables: j.variables }
}

export interface Side { status: number | null; failed: string | null; size: number | null; durationMs: number | null; reqHeaders: Record<string, string>; resHeaders: Record<string, string>; body?: string }
export interface Diff { field: string; a: string; b: string }
const norm = (v: unknown): string => (v == null ? '' : String(v))
const SKIP = /^(date|age|x-request-id|etag|content-length|cf-ray|server-timing|x-vite-.*|last-modified)$/i

function headerDiffs(prefix: string, a: Record<string, string>, b: Record<string, string>): Diff[] {
  const low = (o: Record<string, string>): Record<string, string> => Object.fromEntries(Object.entries(o).map(([k, v]) => [k.toLowerCase(), v]))
  const x = low(a), y = low(b), out: Diff[] = []
  for (const k of new Set([...Object.keys(x), ...Object.keys(y)])) {
    if (SKIP.test(k)) continue
    if (x[k] !== y[k]) out.push({ field: `${prefix}.${k}`, a: x[k] ?? '—', b: y[k] ?? '—' })
  }
  return out.sort((p, q) => p.field.localeCompare(q.field))
}

/** a (onceki) ile b (sonraki) arasindaki farklar: durum, boyut, sure, basliklar, govde. */
export function diffRequests(a: Side, b: Side): Diff[] {
  const out: Diff[] = []
  const st = (s: Side): string => (s.failed ? `failed: ${s.failed}` : norm(s.status))
  if (st(a) !== st(b)) out.push({ field: 'status', a: st(a), b: st(b) })
  if (a.size !== b.size) out.push({ field: 'size', a: norm(a.size), b: norm(b.size) })
  if (a.durationMs !== b.durationMs && a.durationMs != null && b.durationMs != null && Math.abs(a.durationMs - b.durationMs) >= 5) out.push({ field: 'time', a: `${a.durationMs} ms`, b: `${b.durationMs} ms` })
  out.push(...headerDiffs('request', a.reqHeaders, b.reqHeaders), ...headerDiffs('response', a.resHeaders, b.resHeaders))
  if (a.body != null && b.body != null && a.body !== b.body) out.push({ field: 'body', a: a.body.slice(0, 200), b: b.body.slice(0, 200) })
  return out
}

/** Bir JSON degerinin kok yolundan (a.b[2].c) degerine ulasmak icin yol metni uretir */
export const jsonPath = (parent: string, key: string | number): string => (typeof key === 'number' ? `${parent}[${key}]` : /^[A-Za-z_$][\w$]*$/.test(key) ? (parent ? `${parent}.${key}` : key) : `${parent}[${JSON.stringify(key)}]`)
