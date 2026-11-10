import { describe, expect, it } from 'vitest'
import { formatEval, preview } from './evalformat'

describe('formatEval', () => {
  it('ilkel degerler', () => {
    expect(formatEval({ result: { type: 'number', value: 3 } })).toMatchObject({ ok: true, text: '3' })
    expect(formatEval({ result: { type: 'string', value: 'a"b' } }).text).toBe('"a\\"b"')
    expect(formatEval({ result: { type: 'undefined' } }).text).toBe('undefined')
    expect(formatEval({ result: { type: 'object', subtype: 'null', value: null } }).text).toBe('null')
    expect(formatEval({ result: { type: 'number', unserializableValue: 'NaN' } }).text).toBe('NaN')
  })
  it('nesne ve dizi onizlemesi', () => {
    const o = formatEval({ result: { type: 'object', description: 'Object', preview: { properties: [{ name: 'a', type: 'number', value: '1' }, { name: 's', type: 'string', value: 'x' }], overflow: true } } })
    expect(o.text).toBe('Object {a: 1, s: "x", …}')
    const a = formatEval({ result: { type: 'object', subtype: 'array', description: 'Array(2)', preview: { subtype: 'array', properties: [{ name: '0', type: 'number', value: '1' }, { name: '1', type: 'number', value: '2' }] } } })
    expect(a.text).toBe('Array(2) [1, 2]')
  })
  it('istisna', () => {
    const e = formatEval({ exceptionDetails: { text: 'Uncaught', exception: { description: 'ReferenceError: x is not defined\n    at <anonymous>:1:1' } } })
    expect(e.ok).toBe(false); expect(e.text).toContain('ReferenceError')
  })
  it('console arguman onizlemesi: string ciplak, nesne/dizi/null/fonksiyon', () => {
    expect(preview({ type: 'string', value: 'merhaba' })).toBe('"merhaba"')
    expect(preview({ type: 'function', description: 'function foo() {\n  return 1\n}' })).toBe('function foo() {')
    expect(preview({ type: 'object', subtype: 'null' })).toBe('null')
    expect(preview({ type: 'object', subtype: 'error', description: 'TypeError: x is not a function\n    at f (a.js:1:1)' })).toBe('TypeError: x is not a function')
    expect(preview({ type: 'object', description: 'Object', preview: { properties: [{ name: 'a', type: 'number', value: '1' }, { name: 'n', type: 'object', subtype: 'null' }, { name: 'o', type: 'object', valuePreview: { description: 'Object' } }] } })).toBe('Object {a: 1, n: null, o: Object}')
  })
})
