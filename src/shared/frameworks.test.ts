import { describe, expect, it } from 'vitest'
import { DETECT_SCRIPT, parseDetected, unsupportedComponentFrameworks } from './frameworks'

describe('parseDetected', () => {
  it('bilinen framework, surum ve destek durumu; yinelenen ve bilinmeyenler atilir', () => {
    const d = parseDetected([{ id: 'react', version: '19.0.0' }, { id: 'vue', version: '3.4.2' }, { id: 'react', version: '18' }, { id: 'evil<script>', version: 'x' }, { id: 'next', version: '' }])
    expect(d.map((x) => `${x.id}:${x.version}:${x.supported}`)).toEqual(['react:19.0.0:true', 'vue:3.4.2:false', 'next::false'])
  })
  it('sayfa kontrollu garip veri guvenli: gecersiz surum bosaltilir, dizi degilse bos', () => {
    expect(parseDetected([{ id: 'react', version: '<img onerror=x>' }])[0].version).toBe('')
    expect(parseDetected(null)).toEqual([]); expect(parseDetected({ id: 'react' })).toEqual([])
    expect(parseDetected(Array.from({ length: 50 }, () => ({ id: 'react' })))).toHaveLength(1)
  })
  it('desteklenmeyen bilesen framework listesi (Vue/Svelte/Angular); Next/Vite dahil degil', () => {
    const d = parseDetected([{ id: 'react' }, { id: 'vue' }, { id: 'svelte' }, { id: 'next' }, { id: 'vite' }])
    expect(unsupportedComponentFrameworks(d).map((x) => x.id)).toEqual(['vue', 'svelte'])
  })
  it('tespit betigi gecerli JS ve yalnizca okur (atama/navigasyon yok)', () => {
    expect(() => new Function(`return ${DETECT_SCRIPT}`)).not.toThrow()
    expect(DETECT_SCRIPT).not.toMatch(/\blocation\s*=|\.innerHTML\s*=|fetch\(|XMLHttpRequest|eval\(/)
  })
})
