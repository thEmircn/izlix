import { describe, expect, it } from 'vitest'
import { addSeconds, blockReason, dayKey, lastDays, parseLimits, prune, siteList, topSites, totalSec, type FocusCfg, type Usage } from './usage'
describe('usage', () => {
  it('addSeconds/topSites/totalSec/lastDays/prune', () => {
    const u: Usage = {}; addSeconds(u, 'a.com', 60, '2026-11-10'); addSeconds(u, 'a.com', 30, '2026-11-11'); addSeconds(u, 'b.com', 200, '2026-11-11')
    expect(topSites(u, ['2026-11-10', '2026-11-11'])).toEqual([{ site: 'b.com', sec: 200 }, { site: 'a.com', sec: 90 }]); expect(totalSec(u, '2026-11-11')).toBe(230)
    const d = new Date(2026, 10, 11); expect(lastDays(3, d)).toEqual(['2026-11-09', '2026-11-10', '2026-11-11']); expect(dayKey(d)).toBe('2026-11-11')
    prune(u, 1, d); expect(Object.keys(u)).toEqual(['2026-11-11'])
  })
  it('parseLimits ve siteList', () => {
    expect(parseLimits('youtube.com 30\nbad line\nm.facebook.com 15\nx.com 0')).toEqual({ 'youtube.com': 30, 'facebook.com': 15 })
    expect(siteList('https://www.Twitter.com/x, reddit.com\nnope\nm.reddit.com')).toEqual(['twitter.com', 'reddit.com'])
  })
  it('blockReason: odak listesi, limit, snooze, loopback ve tek etiketli adresler gecer', () => {
    const cfg: FocusCfg = { on: true, sites: ['youtube.com'], limits: { 'reddit.com': 10 }, snooze: { 'x.com': Date.now() + 60000 } }
    const used = (s: string): number => (s === 'reddit.com' ? 700 : 0)
    expect(blockReason('https://www.youtube.com/watch', cfg, used)).toEqual({ reason: 'focus', site: 'youtube.com' })
    expect(blockReason('https://old.reddit.com/', cfg, used)).toEqual({ reason: 'limit', site: 'reddit.com' })
    expect(blockReason('https://reddit.com/', cfg, () => 100)).toBeNull(); expect(blockReason('http://localhost:3000/', cfg, used)).toBeNull(); expect(blockReason('http://intranet/', cfg, used)).toBeNull()
    expect(blockReason('https://youtube.com/', { ...cfg, on: false }, used)).toBeNull(); expect(blockReason('https://x.com/', { on: true, sites: ['x.com'], limits: {}, snooze: cfg.snooze }, used)).toBeNull()
    expect(blockReason('https://youtube.com/', undefined, used)).toBeNull(); expect(blockReason('mailto:a@b.c', cfg, used)).toBeNull()
  })
})
