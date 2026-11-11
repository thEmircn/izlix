// Network -> MSW / Postman / OpenAPI disa aktarma (saf). Yalniz gercek (maskelenmemis) govdeler kullanilir; Authorization/Cookie basliklari HIC yazilmaz.
export interface ExportItem { method: string; url: string; status: number; reqContentType?: string; reqBody?: string; resMime?: string; resBody?: string }
const ID_SEG = /^(\d{1,}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9a-f]{24})$/i

/** Yol parcalarindaki sayi/UUID/ObjectId'yi :id yapar; { path, params } doner */
export function normalizePath(pathname: string): { path: string; params: string[] } {
  const params: string[] = []
  const path = pathname.split('/').map((s) => { if (s && ID_SEG.test(s)) { const n = params.length ? `id${params.length + 1}` : 'id'; params.push(n); return `:${n}` } return s }).join('/')
  return { path: path || '/', params }
}
const parse = (u: string): URL | null => { try { return new URL(u) } catch { return null } }
const isJson = (mime = '', body = ''): boolean => /json/i.test(mime) || (/^\s*[[{]/.test(body) && (() => { try { JSON.parse(body); return true } catch { return false } })())
const tryJson = (s: string | undefined): unknown => { if (!s) return undefined; try { return JSON.parse(s) } catch { return undefined } }

/** Ornekten JSON Schema (derinlik 5, dizi icin ilk 5 ogenin birlesimi) */
export function inferSchema(v: unknown, depth = 0): Record<string, unknown> {
  if (v === null) return { nullable: true }
  if (Array.isArray(v)) return { type: 'array', items: v.length && depth < 5 ? mergeSchemas(v.slice(0, 5).map((x) => inferSchema(x, depth + 1))) : {} }
  switch (typeof v) {
    case 'string': return { type: 'string' }
    case 'number': return Number.isInteger(v) ? { type: 'integer' } : { type: 'number' }
    case 'boolean': return { type: 'boolean' }
    case 'object': {
      if (depth >= 5) return { type: 'object' }
      const props: Record<string, unknown> = {}; for (const [k, x] of Object.entries(v as object)) props[k] = inferSchema(x, depth + 1)
      return { type: 'object', properties: props, required: Object.keys(props) }
    }
    default: return {}
  }
}
function mergeSchemas(list: Record<string, unknown>[]): Record<string, unknown> {
  if (list.length === 1) return list[0]
  const objs = list.filter((s) => s.type === 'object')
  if (objs.length === list.length) {
    const props: Record<string, unknown> = {}; const count: Record<string, number> = {}
    for (const o of objs) for (const [k, s] of Object.entries((o.properties ?? {}) as Record<string, Record<string, unknown>>)) { props[k] = props[k] ? mergeSchemas([props[k] as Record<string, unknown>, s]) : s; count[k] = (count[k] ?? 0) + 1 }
    return { type: 'object', properties: props, required: Object.keys(count).filter((k) => count[k] === objs.length) }
  }
  const t = new Set(list.map((s) => s.type)); return t.size === 1 ? list[0] : {}
}

const key = (i: ExportItem): { m: string; path: string; params: string[]; origin: string } | null => { const u = parse(i.url); if (!u) return null; const n = normalizePath(u.pathname); return { m: i.method.toUpperCase(), path: n.path, params: n.params, origin: u.origin } }
/** Ayni (yontem, yol) icin son basarili ornek kalir */
function dedupe(items: ExportItem[]): Map<string, { item: ExportItem; k: NonNullable<ReturnType<typeof key>> }> {
  const m = new Map<string, { item: ExportItem; k: NonNullable<ReturnType<typeof key>> }>()
  for (const i of items) { const k = key(i); if (!k) continue; const id = `${k.m} ${k.path}`; const cur = m.get(id); if (!cur || (i.status < 400 && cur.item.status >= 400) || i.status < 400) m.set(id, { item: i, k }) }
  return m
}
const q = (s: string): string => JSON.stringify(s)

/** MSW v2 isleyici dosyasi: her (yontem, yol) icin bir handler; govde JSON ise HttpResponse.json */
export function toMsw(items: ExportItem[]): string {
  const lines: string[] = ["import { http, HttpResponse } from 'msw'", '', 'export const handlers = [']
  for (const { item, k } of dedupe(items).values()) {
    const method = k.m.toLowerCase(); if (!['get', 'post', 'put', 'patch', 'delete', 'head', 'options'].includes(method)) continue
    const j = isJson(item.resMime, item.resBody) ? tryJson(item.resBody) : undefined
    const status = item.status || 200
    const body = j !== undefined ? `HttpResponse.json(${JSON.stringify(j, null, 2).replace(/\n/g, '\n    ')}, { status: ${status} })` : `new HttpResponse(${q(item.resBody ?? '')}, { status: ${status}, headers: { 'Content-Type': ${q(item.resMime || 'text/plain')} } })`
    lines.push(`  http.${method}('*${k.path}', () => {`, `    return ${body}`, '  }),')
  }
  lines.push(']', '')
  return lines.join('\n')
}

/** Postman Collection v2.1 */
export function toPostman(items: ExportItem[], name = 'Izlix export'): string {
  const entries = [...dedupe(items).values()].map(({ item, k }) => {
    const u = parse(item.url)!
    const req: Record<string, unknown> = { method: k.m, header: item.reqContentType ? [{ key: 'Content-Type', value: item.reqContentType }] : [], url: { raw: item.url, protocol: u.protocol.replace(':', ''), host: u.hostname.split('.'), ...(u.port ? { port: u.port } : {}), path: u.pathname.split('/').filter(Boolean), query: [...u.searchParams].map(([key2, value]) => ({ key: key2, value })) } }
    if (item.reqBody) req.body = { mode: 'raw', raw: item.reqBody, options: { raw: { language: isJson(item.reqContentType, item.reqBody) ? 'json' : 'text' } } }
    const resp = item.resBody !== undefined ? [{ name: String(item.status), originalRequest: req, status: String(item.status), code: item.status, header: item.resMime ? [{ key: 'Content-Type', value: item.resMime }] : [], body: item.resBody }] : []
    return { name: `${k.m} ${k.path}`, request: req, response: resp }
  })
  return JSON.stringify({ info: { name, schema: 'https://schema.getpostman.com/json/collection/v2.1.0/collection.json' }, item: entries }, null, 2)
}

/** OpenAPI 3.0.3 (JSON): yol parametreleri, ornekten cikarilan istek/yanit semalari */
export function toOpenApi(items: ExportItem[], title = 'Izlix export'): string {
  const paths: Record<string, Record<string, unknown>> = {}
  const servers = new Set<string>()
  for (const { item, k } of dedupe(items).values()) {
    servers.add(k.origin)
    const op: Record<string, unknown> = { summary: `${k.m} ${k.path}`, responses: {} as Record<string, unknown> }
    const u = parse(item.url)!
    const parameters: unknown[] = [...k.params.map((p) => ({ name: p, in: 'path', required: true, schema: { type: 'string' } })), ...[...u.searchParams.keys()].map((n) => ({ name: n, in: 'query', schema: { type: 'string' } }))]
    if (parameters.length) op.parameters = parameters
    const rb = isJson(item.reqContentType, item.reqBody) ? tryJson(item.reqBody) : undefined
    if (rb !== undefined) op.requestBody = { content: { 'application/json': { schema: inferSchema(rb) } } }
    const rj = isJson(item.resMime, item.resBody) ? tryJson(item.resBody) : undefined
    ;(op.responses as Record<string, unknown>)[String(item.status || 200)] = { description: `HTTP ${item.status}`, ...(rj !== undefined ? { content: { 'application/json': { schema: inferSchema(rj) } } } : {}) }
    ;(paths[k.path.replace(/:([\w]+)/g, '{$1}')] ??= {})[k.m.toLowerCase()] = op
  }
  return JSON.stringify({ openapi: '3.0.3', info: { title, version: '1.0.0' }, servers: [...servers].map((url) => ({ url })), paths }, null, 2)
}
