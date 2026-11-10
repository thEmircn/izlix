import { describe, expect, it } from 'vitest'
import { mkdtempSync, existsSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Telemetry, sanitizeProps } from './telemetry'

describe('Telemetry', () => {
  const mk = (consent: string): { t: Telemetry; dir: string } => { const dir = mkdtempSync(join(tmpdir(), 'tel-')); return { dir, t: new Telemetry(dir, () => consent, () => 'inst', undefined) } }
  it('izin yokken veya reddedilmisken hicbir sey yazilmaz', () => {
    for (const c of ['unset', 'denied']) { const { t, dir } = mk(c); expect(t.track('app.start')).toBe(false); expect(existsSync(join(dir, 'telemetry.ndjson'))).toBe(false) }
  })
  it('izinle yazilir; bilinmeyen olay adi reddedilir', () => {
    const { t, dir } = mk('granted')
    expect(t.track('timeline.open', { events: 12 })).toBe(true)
    expect(t.track('evil.event' as any)).toBe(false)
    const lines = readFileSync(join(dir, 'telemetry.ndjson'), 'utf8').trim().split('\n')
    expect(lines).toHaveLength(1)
    expect(JSON.parse(lines[0])).toMatchObject({ name: 'timeline.open', id: 'inst', props: { events: 12 } })
  })
  it('URL, yol ve serbest metin ozellik olarak girmez', () => {
    expect(sanitizeProps({ a: 'https://x.com/secret', b: '/Users/me/p', c: 'ok-tag', d: 3, e: true, f: 'bosluk var', g: 'x'.repeat(41), h: {} as any, i: NaN })).toEqual({ c: 'ok-tag', d: 3, e: true })
  })
})
