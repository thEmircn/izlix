import { describe, expect, it } from 'vitest'
import { autoCollapsed, attrMap, findByKey, findNode, keyOf, flatten, pathTo, selectorOf, type DomNode } from './dom'

let id = 0
const el = (name: string, attrs: string[] = [], children: DomNode[] = []): DomNode => ({ nodeId: ++id, nodeType: 1, nodeName: name.toUpperCase(), localName: name, attributes: attrs, children })
const txt = (v: string): DomNode => ({ nodeId: ++id, nodeType: 3, nodeName: '#text', nodeValue: v })
const li1 = el('li', ['class', 'a b c']), li2 = el('li'), li3 = el('li', ['id', 'last'])
const ul = el('ul', ['class', 'list'], [li1, txt('  \n '), li2, li3])
const script = el('script', [], [txt('x=1')])
const body = el('body', [], [el('div', ['id', 'root'], [ul]), script, el('img'), txt('hello')])
const html = el('html', [], [el('head'), body])
const doc: DomNode = { nodeId: ++id, nodeType: 9, nodeName: '#document', children: [{ nodeId: ++id, nodeType: 10, nodeName: 'html' }, html] }

describe('dom yardimcilari', () => {
  it('flatten: bosluk metinleri atlanir, kapanis etiketleri eklenir, void elemanda kapanis yok', () => {
    const rows = flatten(doc, new Set())
    const names = rows.map((r) => (r.close ? '/' : '') + (r.node.nodeType === 3 ? '"' + r.node.nodeValue + '"' : r.node.nodeName.toLowerCase()))
    expect(names).toContain('/ul'); expect(names).not.toContain('/img'); expect(names).toContain('"hello"')
    expect(rows.filter((r) => r.node.nodeType === 3 && !r.node.nodeValue!.trim())).toHaveLength(0)
    expect(rows[0].node.nodeName).toBe('html') // doctype
  })
  it('kapali dugum alt satirlarini ve kapanisini gizler', () => {
    const rows = flatten(doc, new Set([ul.nodeId]))
    expect(rows.some((r) => r.node === li1)).toBe(false)
    expect(rows.filter((r) => r.node === ul)).toHaveLength(1) // kapanis satiri yok
  })
  it('autoCollapsed script/style/svg', () => { expect(autoCollapsed(doc).has(script.nodeId)).toBe(true) })
  it('kararli anahtar: backendNodeId varsa o kullanilir; yeniden yuklemede ayni dugum bulunur', () => {
    const a: DomNode = { nodeId: 1, backendNodeId: 77, nodeType: 1, nodeName: 'DIV', localName: 'div', children: [] }
    expect(keyOf(a)).toBe(77); expect(keyOf({ ...a, backendNodeId: undefined })).toBe(1)
    const reloaded: DomNode = { nodeId: 500, nodeType: 9, nodeName: '#document', children: [{ ...a, nodeId: 999 }] }
    expect(findByKey(reloaded, 77)!.nodeId).toBe(999)
  })
  it('pathTo / findNode / attrMap', () => {
    expect(pathTo(doc, li2.nodeId)).toEqual([doc.nodeId, html.nodeId, body.nodeId, body.children![0].nodeId, ul.nodeId])
    expect(findNode(doc, li3.nodeId)).toBe(li3); expect(findNode(doc, 99999)).toBeNull()
    expect(attrMap(li1)).toEqual({ class: 'a b c' })
  })
  it('selectorOf: id kisa devre yapar; siniflar ve nth-of-type', () => {
    expect(selectorOf(doc, li3.nodeId)).toBe('#last')
    expect(selectorOf(doc, li1.nodeId)).toBe('#root > ul.list > li.a.b:nth-of-type(1)')
    expect(selectorOf(doc, li2.nodeId)).toBe('#root > ul.list > li:nth-of-type(2)')
  })
})
