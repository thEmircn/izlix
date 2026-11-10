import type { BusEvent } from './events'

export const LANES = ['input', 'hmr', 'request', 'response', 'render', 'console', 'error'] as const
export type Lane = (typeof LANES)[number]
export const LANE_COLOR: Record<Lane, string> = { input: '#a1a1aa', hmr: '#2dd4bf', request: '#f4f4f5', response: '#a3e635', render: '#ffb454', console: '#71717a', error: '#ff5c5c' }

export const shortUrl = (u: string): string => { try { const x = new URL(u); return x.pathname + x.search } catch { return u } }

/** Olayin tek satirlik insan okunur ozeti (Timeline ve Overview ortak kullanir). */
export function eventLabel(e: BusEvent): string {
  const p = e.payload
  switch (e.kind) {
    case 'input': return `${p.name} ${p.target}`
    case 'request': return `${p.modified ? 'modified · ' : ''}${p.method} ${shortUrl(p.url)}`
    case 'response': return `${p.status} ${shortUrl(p.url)}`
    case 'render': return `commit · ${p.count} render`
    case 'error': return String(p.text ?? p.errorText ?? 'error').split('\n')[0]
    case 'hmr': return `HMR ${p.file ?? p.action}`
    case 'marker': return `Marker: ${p.text}`
    case 'console': return String(p.text ?? '')
    case 'navigation': return p.url ? `Navigate ${shortUrl(String(p.url))}` : 'Navigation'
    default: return e.source
  }
}
