import { describe, expect, it } from 'vitest'
import { buildAxTree, flattenAx, markIssues, summarizeAx, type AxRaw } from './axtree'

const n = (nodeId: string, role: string, name = '', childIds: string[] = [], extra: Partial<AxRaw> = {}): AxRaw => ({ nodeId, role: { value: role }, name: { value: name }, childIds, ...extra })
const raw: AxRaw[] = [
  n('1', 'RootWebArea', 'Page', ['2', '3', '4', '8']),
  n('2', 'generic', '', ['5']),
  n('5', 'button', 'Save', ['6']),
  n('6', 'StaticText', 'Save'),
  n('3', 'button', '', [], { backendDOMNodeId: 30 }),
  n('4', 'heading', 'Title', ['7'], { properties: [{ name: 'level', value: { value: 1 } }] }),
  n('7', 'StaticText', 'Title'),
  n('8', 'heading', 'Deep', [], { properties: [{ name: 'level', value: { value: 4 } }] }),
  { nodeId: '9', ignored: true, role: { value: 'none' }, childIds: [] }
]
describe('buildAxTree', () => {
  const root = buildAxTree(raw)!
  it('gurultu dugumleri (generic) budanir, cocuklari yukari alinir; tekrarlayan StaticText atilir', () => {
    expect(root.role).toBe('RootWebArea')
    expect(root.children.map((c) => `${c.role}:${c.name}`)).toEqual(['button:Save', 'button:', 'heading:Title', 'heading:Deep'])
    expect(root.children[0].children).toEqual([]); expect(root.children[2].props.level).toBe('1')
  })
  it('sorunlar: adsiz buton, baslik seviyesi atlamasi; ozet sayilari', () => {
    const issues = markIssues(root)
    expect(issues).toBe(2); expect(root.children[1].issue).toBe('noName'); expect(root.children[3].issue).toBe('levelJump')
    expect(summarizeAx(root)).toEqual({ nodes: 5, landmarks: 0, headings: 2, interactive: 2, issues: 2 })
  })
  it('duz liste: daraltma, arama ve yalnizca sorunlular', () => {
    expect(flattenAx(root, new Set()).length).toBe(5)
    expect(flattenAx(root, new Set([root.id])).length).toBe(1)
    expect(flattenAx(root, new Set(), { q: 'deep' }).map((r) => r.node.name)).toEqual(['Deep'])
    expect(flattenAx(root, new Set(), { onlyIssues: true }).map((r) => r.node.issue)).toEqual(['noName', 'levelJump'])
  })
  it('bos giris null; birden fazla main isaretlenir', () => {
    expect(buildAxTree([])).toBeNull()
    const two = buildAxTree([n('1', 'RootWebArea', '', ['2', '3']), n('2', 'main', 'a'), n('3', 'main', 'b')])!
    expect(markIssues(two)).toBe(2)
  })
})
