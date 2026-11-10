import type { BusEvent } from './events'

export type Level = 'error' | 'warn' | 'info' | 'log' | 'debug'

export interface ConsoleRow {
  id: number          // ilk olayin kimligi
  ts: number
  level: Level
  text: string
  count: number       // ardisik ayni mesajlar tek satirda toplanir
  source: string      // 'console' | 'exception' | 'network'
  stack?: { fn: string; url: string; line: number; col: number }[]
  origin?: { file: string; line: number; column?: number; component?: string }
  eventIds: number[]
}

const LEVEL: Record<string, Level> = { error: 'error', assert: 'error', warning: 'warn', warn: 'warn', info: 'info', log: 'log', debug: 'debug', trace: 'debug', dir: 'log', table: 'log' }

function frames(stack: any): ConsoleRow['stack'] {
  const out: NonNullable<ConsoleRow['stack']> = []
  for (let st = stack; st && out.length < 12; st = st.parent) for (const f of st.callFrames ?? []) out.push({ fn: f.functionName || '(anonymous)', url: f.url, line: (f.lineNumber ?? 0) + 1, col: (f.columnNumber ?? 0) + 1 })
  return out.length ? out : undefined
}

/** console + istisna + basarisiz ag isteklerini tek listeye cevirir; ardisik ayni mesajlar sayilir. */
export function buildConsoleRows(events: Iterable<BusEvent>): ConsoleRow[] {
  const rows: ConsoleRow[] = []
  for (const e of events) {
    const p = e.payload
    let row: ConsoleRow | null = null
    if (e.kind === 'console') {
      row = { id: e.id, ts: e.ts, level: LEVEL[p.level] ?? 'log', text: String(p.text ?? ''), count: 1, source: 'console', stack: frames(p.stackTrace), origin: p.origin, eventIds: [e.id] }
    } else if (e.kind === 'error') {
      const text = p.requestId ? `Failed to load ${p.url ?? 'resource'}: ${p.errorText ?? ''}`.trim() : String(p.text ?? p.errorText ?? p.message ?? 'Error')
      row = { id: e.id, ts: e.ts, level: 'error', text, count: 1, source: p.requestId ? 'network' : 'exception', stack: frames(p.stackTrace), origin: p.origin, eventIds: [e.id] }
    }
    if (!row) continue
    const last = rows[rows.length - 1]
    if (last && last.level === row.level && last.text === row.text && last.source === row.source) { last.count++; last.eventIds.push(e.id); last.ts = row.ts; if (!last.origin && row.origin) last.origin = row.origin }
    else rows.push(row)
  }
  return rows
}

export const LEVEL_ORDER: Level[] = ['error', 'warn', 'info', 'log', 'debug']
