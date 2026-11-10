import { describe, expect, it } from 'vitest'
import { diffRequests, jsonPath, parseGraphql } from './netlab'

describe('parseGraphql', () => {
  it('operationName, sorgu adi, ad-siz sorgu ve mutation', () => {
    expect(parseGraphql(JSON.stringify({ operationName: 'GetUser', query: 'query GetUser($id: ID!) { user(id: $id) { name } }', variables: { id: 1 } }))).toMatchObject({ op: 'GetUser', type: 'query', variables: { id: 1 } })
    expect(parseGraphql(JSON.stringify({ query: 'mutation AddItem { add { id } }' }))).toMatchObject({ op: 'AddItem', type: 'mutation' })
    expect(parseGraphql(JSON.stringify({ query: '{ me { id } }' }))).toMatchObject({ op: null, type: 'query' })
    expect(parseGraphql(JSON.stringify([{ query: 'query A { a }' }, { query: 'query B { b }' }]))).toMatchObject({ op: 'A' })
  })
  it('GraphQL olmayan govdeler null', () => {
    expect(parseGraphql(undefined)).toBeNull(); expect(parseGraphql('not json')).toBeNull(); expect(parseGraphql('{"a":1}')).toBeNull(); expect(parseGraphql('{"query":"hello world"}')).toBeNull()
  })
})
describe('diffRequests', () => {
  const base = { status: 200, failed: null, size: 100, durationMs: 50, reqHeaders: { Accept: 'x', Authorization: 'a' }, resHeaders: { 'Content-Type': 'json', Date: 'd1' }, body: '{"a":1}' }
  it('ayni istek fark uretmez (gurultu basliklari ve kucuk sure farki yok sayilir)', () => {
    expect(diffRequests(base, { ...base, durationMs: 52, resHeaders: { 'content-type': 'json', Date: 'd2' } })).toEqual([])
  })
  it('durum, boyut, sure, baslik ve govde farklari', () => {
    const d = diffRequests(base, { status: 500, failed: null, size: 20, durationMs: 400, reqHeaders: { Accept: 'x' }, resHeaders: { 'Content-Type': 'json', 'X-New': '1' }, body: 'oops' })
    expect(d.map((x) => x.field)).toEqual(['status', 'size', 'time', 'request.authorization', 'response.x-new', 'body'])
    expect(d[0]).toEqual({ field: 'status', a: '200', b: '500' })
  })
})
describe('jsonPath', () => { it('yol metni', () => { expect(jsonPath('', 'a')).toBe('a'); expect(jsonPath('a', 3)).toBe('a[3]'); expect(jsonPath('a', 'b-c')).toBe('a["b-c"]'); expect(jsonPath('a[3]', 'x')).toBe('a[3].x') }) })
