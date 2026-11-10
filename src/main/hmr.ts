/** Vite / Next (Fast Refresh) HMR konsol mesajlarini tanir. */
export interface HmrInfo { tool: 'vite' | 'next'; action: 'update' | 'reload' | 'rebuilding' | 'done'; file?: string; ms?: number }

export function parseHmr(text: string): HmrInfo | null {
  let m = /^\[vite\] (hot updated|css hot updated|page reload|full reload)[:\s]*(\S*)/.exec(text)
  if (m) return { tool: 'vite', action: m[1].includes('reload') ? 'reload' : 'update', file: m[2] || undefined }
  m = /^\[Fast Refresh\] (rebuilding|done in (\d+)ms)/.exec(text)
  if (m) return m[1] === 'rebuilding' ? { tool: 'next', action: 'rebuilding' } : { tool: 'next', action: 'done', ms: Number(m[2]) }
  return null
}
