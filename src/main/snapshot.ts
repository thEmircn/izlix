import { gzipSync, gunzipSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import type { BusEvent } from '../shared/events'
import { toNdjson } from './report-data'

/** Anlik goruntu (K-09): maskeli, gzip'li NDJSON. Yalnizca kullanici isteyince diske yazilir. */
export const encodeSnapshot = (events: BusEvent[]): Buffer => gzipSync(Buffer.from(toNdjson(events)))
export const decodeSnapshot = (buf: Buffer): BusEvent[] => gunzipSync(buf).toString('utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l))

export function saveSnapshot(dir: string, events: BusEvent[], now = new Date()): string {
  mkdirSync(dir, { recursive: true })
  const file = join(dir, `timeline-${now.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.ndjson.gz`)
  writeFileSync(file, encodeSnapshot(events))
  return file
}

/** Diskteki .ndjson.gz'yi okur; yalnizca beklenen alanlara sahip olaylari kabul eder (dis dosya guvenilmez) */
export function loadSnapshot(file: string): BusEvent[] {
  const events = decodeSnapshot(readFileSync(file))
  const kinds = new Set(['input', 'state', 'request', 'response', 'render', 'console', 'error', 'navigation', 'hmr', 'vital', 'ws', 'marker'])
  return events.filter((e) => e && typeof e.id === 'number' && typeof e.ts === 'number' && kinds.has(e.kind) && e.payload && typeof e.payload === 'object' && Array.isArray(e.links))
    .map((e) => ({ ...e, causeIds: Array.isArray(e.causeIds) ? e.causeIds : [], links: e.links.filter((l) => l && typeof l.from === 'number') }))
}
