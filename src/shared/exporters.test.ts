import { describe, expect, it } from 'vitest'
import { inferSchema, normalizePath, toMsw, toOpenApi, toPostman, type ExportItem } from './exporters'

const items: ExportItem[] = [
  { method: 'GET', url: 'http://localhost:5173/api/items/12?sort=asc', status: 200, resMime: 'application/json', resBody: '{"id":12,"name":"A","tags":["x"],"price":1.5}' },
  { method: 'GET', url: 'http://localhost:5173/api/items/99', status: 404, resMime: 'application/json', resBody: '{"error":"yok"}' },
  { method: 'POST', url: 'http://localhost:5173/api/items', status: 201, reqContentType: 'application/json', reqBody: '{"name":"B","qty":2}', resMime: 'application/json', resBody: '{"id":13}' },
  { method: 'GET', url: 'http://localhost:5173/health', status: 200, resMime: 'text/plain', resBody: 'ok' }
]
describe('exporters', () => {
  it('normalizePath: sayi/UUID/ObjectId -> :id, ikinci parametre id2', () => {
    expect(normalizePath('/api/items/12')).toEqual({ path: '/api/items/:id', params: ['id'] }); expect(normalizePath('/u/5/p/6').params).toEqual(['id', 'id2'])
    expect(normalizePath('/a/123e4567-e89b-12d3-a456-426614174000/x').path).toBe('/a/:id/x'); expect(normalizePath('/health').params).toEqual([])
  })
  it('inferSchema: ilkel, nesne (required), dizi birlesimi, ic ice', () => {
    expect(inferSchema({ a: 1, b: 'x', c: [1.5], d: { e: true } })).toEqual({ type: 'object', properties: { a: { type: 'integer' }, b: { type: 'string' }, c: { type: 'array', items: { type: 'number' } }, d: { type: 'object', properties: { e: { type: 'boolean' } }, required: ['e'] } }, required: ['a', 'b', 'c', 'd'] })
    expect(inferSchema([{ a: 1, b: 2 }, { a: 3 }])).toMatchObject({ items: { required: ['a'] } })
  })
  it('toMsw: (yontem,yol) basina handler; ayni yolda basarili ornek; JSON/metin', () => {
    const s = toMsw(items)
    expect(s).toContain("import { http, HttpResponse } from 'msw'"); expect(s).toContain("http.get('*/api/items/:id'"); expect(s).toContain("http.post('*/api/items'"); expect(s).toContain('"name": "A"') // 404 degil, 200 ornegi
    expect(s).not.toContain('yok'); expect(s).toContain("new HttpResponse(\"ok\""); expect((s.match(/http\.get\(/g) ?? []).length).toBe(2)
  })
  it('toPostman: v2.1, govde ve yanit ornegi', () => {
    const c = JSON.parse(toPostman(items, 'T'))
    expect(c.info.schema).toContain('v2.1.0'); expect(c.item).toHaveLength(3); const post = c.item.find((i: any) => i.request.method === 'POST')
    expect(post.request.body.raw).toBe('{"name":"B","qty":2}'); expect(post.response[0].code).toBe(201)
  })
  it('toOpenApi: yol parametresi, sorgu, istek/yanit semasi', () => {
    const o = JSON.parse(toOpenApi(items, 'T'))
    expect(o.openapi).toBe('3.0.3'); expect(Object.keys(o.paths)).toEqual(['/api/items/{id}', '/api/items', '/health'])
    const g = o.paths['/api/items/{id}'].get; expect(g.parameters.map((p: any) => p.name)).toEqual(['id', 'sort']); expect(g.responses['200'].content['application/json'].schema.properties.price).toEqual({ type: 'number' })
    expect(o.paths['/api/items'].post.requestBody.content['application/json'].schema.properties.qty).toEqual({ type: 'integer' }); expect(o.servers).toEqual([{ url: 'http://localhost:5173' }])
  })
})
