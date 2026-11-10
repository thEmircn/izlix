import type { BusEvent } from '../shared/events'
import { maskDeep, maskString } from '../shared/mask'
import { summarizeVitals } from '../shared/vitals'

/** Olay listesinden HAR 1.2 (istek/yanit cifti; baslik ve govde toplanmadigi icin sizinti yok). */
export function buildHar(events: BusEvent[], version = '0.1'): object {
  const res = new Map<string, BusEvent>()
  for (const e of events) if (e.kind === 'response') res.set(e.payload.requestId, e)
  const entries = events.filter((e) => e.kind === 'request').map((rq) => {
    const rs = res.get(rq.payload.requestId)
    const time = rs ? Math.max(0, rs.ts - rq.ts) : -1
    return {
      startedDateTime: new Date(rq.ts).toISOString(), time,
      request: { method: rq.payload.method, url: maskString(rq.payload.url), httpVersion: 'HTTP/1.1', headers: [], queryString: [], cookies: [], headersSize: -1, bodySize: -1 },
      response: { status: rs?.payload.status ?? 0, statusText: '', httpVersion: 'HTTP/1.1', headers: [], cookies: [], content: { size: -1, mimeType: rs?.payload.mimeType ?? '' }, redirectURL: '', headersSize: -1, bodySize: -1 },
      cache: {}, timings: { send: 0, wait: time < 0 ? 0 : time, receive: 0 },
      _izlix: { modified: rq.payload.modified ?? null, causeIds: rq.causeIds }
    }
  })
  return { log: { version: '1.2', creator: { name: 'izlix', version }, entries } }
}

export interface ReportEnv { url: string; title: string; workspace: string; app: string; electron: string; chrome: string; os: string; arch: string; generatedAt: string }

/** Markdown ozet: hata sebebini aramaya baslamak icin gereken en kisa gorunum. */
export function buildSummary(events: BusEvent[], env: ReportEnv): string {
  const byId = new Map(events.map((e) => [e.id, e]))
  const errors = events.filter((e) => e.kind === 'error' || (e.kind === 'console' && e.payload.level === 'error'))
  const reqs = events.filter((e) => e.kind === 'request')
  const resByReq = new Map(events.filter((e) => e.kind === 'response').map((e) => [e.payload.requestId, e]))
  const failed = reqs.filter((r) => { const s = resByReq.get(r.payload.requestId)?.payload.status; return s >= 400 })
  const modified = reqs.filter((r) => r.payload.modified)
  const links = events.flatMap((e) => e.links)
  const line = (e: BusEvent): string => {
    const p = e.payload
    const t = new Date(e.ts).toISOString().slice(11, 23)
    if (e.kind === 'request') return `${t} ${p.method} ${p.url}`
    return `${t} ${String(p.text ?? p.errorText ?? e.source).split('\n')[0]}`
  }
  const chain = (e: BusEvent): string[] => {
    const out: string[] = []
    let cur: BusEvent | undefined = e, guard = 0
    while (cur && cur.links.length && guard++ < 8) {
      const l = cur.links[0]; const from = byId.get(l.from)
      if (!from) break
      out.push(`${from.kind} #${from.id} →(${l.type}, ${l.certainty === 'exact' ? 'kesin' : 'tahmini'})`)
      cur = from
    }
    return out.reverse()
  }
  const md: string[] = [
    '# Bug Report', '',
    `- **Sayfa:** ${maskString(env.url)} (${env.title})`, `- **Workspace:** ${env.workspace}`, `- **Zaman:** ${env.generatedAt}`,
    `- **Ortam:** ${env.app} · Electron ${env.electron} · Chromium ${env.chrome} · ${env.os} ${env.arch}`, '',
    '## Özet', '',
    `- ${events.length} olay, ${reqs.length} istek, ${failed.length} başarısız (HTTP ≥ 400), ${errors.length} hata`,
    `- Nedensellik bağları: ${links.filter((l) => l.certainty === 'exact').length} kesin, ${links.filter((l) => l.certainty === 'estimated').length} tahmini`,
    `- Request Rules ile değiştirilen istek: ${modified.length}`, ''
  ]
  const pf = summarizeVitals(events)
  if (pf.vitals.length || pf.tbt) {
    md.push('## Performans', '')
    for (const v of pf.vitals) md.push(`- ${v.name}: ${v.unit === 'ms' ? Math.round(v.value) + ' ms' : v.value.toFixed(3)} (${v.rating})`)
    md.push(`- TBT: ${pf.tbt} ms, uzun görev: ${pf.longTasks.length}`, '')
  }
  if (errors.length) {
    md.push('## Hatalar', '')
    for (const e of errors.slice(-10)) { md.push(`- \`${maskString(line(e)).slice(0, 300)}\``); const c = chain(e); if (c.length) md.push(`  - zincir: ${c.join(' ')} **${e.kind}**`) }
    md.push('')
  }
  if (failed.length) { md.push('## Başarısız istekler', ''); for (const r of failed.slice(-10)) md.push(`- ${resByReq.get(r.payload.requestId)!.payload.status} ${maskString(line(r))}`); md.push('') }
  if (modified.length) { md.push('## Değiştirilen istekler (Request Rules)', ''); for (const r of modified.slice(-10)) md.push(`- ${r.payload.modified.kinds.join('+')} ${maskString(line(r))}`); md.push('') }
  md.push('## Dosyalar', '', '- `timeline.ndjson` — tüm olaylar (maskeli)', '- `network.har` — HAR 1.2 (başlık/gövde toplanmaz)', '- `console.json` — console ve hata olayları', '- `screenshot.png` — sayfa görüntüsü (**maskelenmez**; paylaşmadan önce kontrol et)', '- `environment.json`', '')
  return md.join('\n')
}

export const toNdjson = (events: BusEvent[]): string => events.map((e) => JSON.stringify(maskDeep(e))).join('\n') + '\n'
export const consoleDump = (events: BusEvent[]): object[] => events.filter((e) => e.kind === 'console' || e.kind === 'error').map((e) => maskDeep({ ts: e.ts, kind: e.kind, ...e.payload }))
