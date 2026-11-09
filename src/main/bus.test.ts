import { describe, expect, it } from 'vitest'
import { EventBus } from './bus'

const ev = (tabId = 't1') => ({ tabId, kind: 'input' as const, source: 'test', payload: {} })

describe('EventBus', () => {
  it('olaylara artan id ve verilen ts atar', () => {
    const bus = new EventBus(() => 1000)
    const a = bus.emit({ ...ev(), ts: 5 }), b = bus.emit(ev())
    expect([a.id, b.id]).toEqual([1, 2])
    expect([a.ts, b.ts]).toEqual([5, 1000])
  })

  it('15 dakikadan eski olaylari tampondan atar', () => {
    let now = 0
    const bus = new EventBus(() => now)
    bus.emit(ev()); now = 16 * 60 * 1000; bus.emit(ev())
    expect(bus.snapshot('t1')).toHaveLength(1)
    expect(bus.get(1)).toBeUndefined()
  })

  it('50.000 olay sinirini sekme basina uygular', () => {
    const bus = new EventBus(() => 0)
    for (let i = 0; i < 50_010; i++) bus.emit(ev('a'))
    bus.emit(ev('b'))
    expect(bus.snapshot('a')).toHaveLength(50_000)
    expect(bus.snapshot('b')).toHaveLength(1)
  })

  it('baglari kesin/tahmini isaretler, tekrarlari ve bilinmeyen id lerini yok sayar', () => {
    const bus = new EventBus(() => 0)
    const a = bus.emit(ev()), b = bus.emit(ev())
    bus.link(b.id, a.id, 'exact', 'x'); bus.link(b.id, a.id, 'estimated', 'x'); bus.link(b.id, 999, 'exact', 'x')
    expect(b.links).toEqual([{ from: a.id, certainty: 'exact', type: 'x' }])
    expect(b.causeIds).toEqual([a.id])
  })

  it('degisiklikleri dinleyicilere new/update olarak bildirir', () => {
    const bus = new EventBus(() => 0)
    const seen: string[] = []
    bus.subscribe((_e, c) => seen.push(c))
    const a = bus.emit(ev()); bus.patch(a.id, { z: 1 })
    expect(seen).toEqual(['new', 'update'])
    expect(a.payload.z).toBe(1)
  })
})
