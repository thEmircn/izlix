import { describe, expect, it } from 'vitest'
import { parseRemote, remoteUrl } from './suggest-remote'
describe('suggest-remote', () => {
  it('OpenSearch ve DuckDuckGo bicimlerini ayristirir', () => {
    expect(parseRemote(['kedi', ['kedi resimleri', 'kedi maması']])).toEqual(['kedi resimleri', 'kedi maması'])
    expect(parseRemote([{ phrase: 'react hooks' }, { phrase: 'react' }, { x: 1 }])).toEqual(['react hooks', 'react'])
    expect(parseRemote({ a: 1 })).toEqual([]); expect(parseRemote(null)).toEqual([])
  })
  it('limit ve tekrar', () => { expect(parseRemote(['q', ['a', 'a', 'b', 'c']], 2)).toEqual(['a', 'b']) })
  it('uc nokta sorguyu kodlar, bilinmeyen motor null', () => {
    expect(remoteUrl('google', 'a b&c')).toContain('q=a%20b%26c'); expect(remoteUrl('yok', 'x')).toBeNull()
  })
})
