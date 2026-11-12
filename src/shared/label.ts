import type { BusEvent, Language } from './events'
import { translate } from './i18n'

export const LANES = ['input', 'hmr', 'request', 'response', 'render', 'console', 'error'] as const
export type Lane = (typeof LANES)[number]
export const LANE_COLOR: Record<Lane, string> = { input: 'var(--ln-input)', hmr: 'var(--ln-hmr)', request: 'var(--ln-request)', response: 'var(--ln-response)', render: 'var(--ln-render)', console: 'var(--ln-console)', error: 'var(--ln-error)' }

export const shortUrl = (u: string): string => { try { const x = new URL(u); return x.pathname + x.search } catch { return u } }

/** Olayin tek satirlik insan okunur ozeti (Timeline ve Overview ortak kullanir). */
export function eventLabel(e: BusEvent, lang: Language = 'en'): string {
  const p = e.payload
  const w = (k: 'modified' | 'marker' | 'navigate' | 'commit'): string => translate(lang, `ev.${k}` as any)
  switch (e.kind) {
    case 'input': return `${p.name} ${p.target}`
    case 'request': return `${p.modified ? w('modified') + ' · ' : ''}${p.method} ${shortUrl(p.url)}`
    case 'response': return `${p.status} ${shortUrl(p.url)}`
    case 'render': return `${w('commit')} · ${p.count} render`
    case 'error': return String(p.text ?? p.errorText ?? 'error').split('\n')[0]
    case 'hmr': return `HMR ${p.file ?? p.action}`
    case 'marker': return `${w('marker')}: ${p.text}`
    case 'console': return String(p.text ?? '')
    case 'navigation': return p.url ? `${w('navigate')} ${shortUrl(String(p.url))}` : w('navigate')
    default: return e.source
  }
}
