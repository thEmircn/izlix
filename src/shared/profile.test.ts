import { describe, expect, it } from 'vitest'
import { analyzeProfile, type CpuProfile } from './profile'

const cf = (fn: string, url = 'http://a/x.js', line = 0) => ({ functionName: fn, url, lineNumber: line })
// root -> main -> (work x2, idle)    work -> helper
const profile: CpuProfile = {
  startTime: 0, endTime: 100000,
  nodes: [
    { id: 1, callFrame: cf('(root)', ''), children: [2, 6] },
    { id: 2, callFrame: cf('main'), children: [3, 5] },
    { id: 3, callFrame: cf('work', 'http://a/x.js', 10), children: [4] },
    { id: 4, callFrame: cf('helper', 'http://a/x.js', 30) },
    { id: 5, callFrame: cf('work', 'http://a/x.js', 10) },
    { id: 6, callFrame: cf('(idle)', '') }
  ],
  // ornekler: (deltalar mikrosaniye; bir sonraki delta bir onceki ornegin suresidir)
  samples: [2, 3, 4, 5, 6],
  timeDeltas: [0, 10000, 20000, 40000, 10000] // sureler(ms): main 10, work 20, helper 40, work 10, idle 20 (son: endTime)
}
describe('analyzeProfile', () => {
  const a = analyzeProfile(profile)
  it('oz sure: ornek suresi dugume yazilir; idle ayrilir', () => {
    const row = (n: string) => a.rows.find((r) => r.name === n)!
    expect(row('main').self).toBeCloseTo(10); expect(row('helper').self).toBeCloseTo(40)
    expect(a.idleMs).toBeCloseTo(20); expect(a.totalMs).toBeCloseTo(80)
  })
  it('ayni fonksiyon farkli yollarda toplanir', () => {
    const w = a.rows.find((r) => r.name === 'work')!
    expect(w.self).toBeCloseTo(30); expect(w.total).toBeCloseTo(70)
  })
  it('en agir (oz sure) ilk sirada', () => { expect(a.rows[0].name).toBe('helper') })
  it('alev agaci: derinlik, toplam ve idle atlanir; cocuklar toplama gore sirali', () => {
    expect(a.flame!.name).toBe('(root)'); expect(a.maxDepth).toBe(3)
    const main = a.flame!.children[0]
    expect(main.name).toBe('main'); expect(main.children.map((c) => c.total)).toEqual([60, 10]); expect(main.total).toBeCloseTo(80)
    expect(a.flame!.children.some((c) => c.name === '(idle)')).toBe(false)
  })
  it('bos profil', () => { expect(analyzeProfile({ nodes: [], startTime: 0, endTime: 0 })).toMatchObject({ rows: [], flame: null, totalMs: 0 }) })
})
