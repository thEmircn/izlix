import { describe, expect, it } from 'vitest'
import { parseHmr } from './hmr'

describe('parseHmr', () => {
  it('vite', () => {
    expect(parseHmr('[vite] hot updated: /src/App.tsx')).toEqual({ tool: 'vite', action: 'update', file: '/src/App.tsx' })
    expect(parseHmr('[vite] css hot updated: /src/a.css')).toMatchObject({ action: 'update', file: '/src/a.css' })
    expect(parseHmr('[vite] page reload src/main.tsx')).toMatchObject({ action: 'reload', file: 'src/main.tsx' })
  })
  it('next fast refresh', () => {
    expect(parseHmr('[Fast Refresh] rebuilding')).toEqual({ tool: 'next', action: 'rebuilding' })
    expect(parseHmr('[Fast Refresh] done in 123ms')).toEqual({ tool: 'next', action: 'done', ms: 123 })
  })
  it('ilgisiz mesajlar null', () => {
    for (const t of ['[vite] connecting...', 'hello', '[vite] connected.', '']) expect(parseHmr(t)).toBeNull()
  })
})
