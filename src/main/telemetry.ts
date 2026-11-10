import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

/** Izinle toplanan, anonim kullanim sayaclari (plan bolum 11). Izin yoksa HICBIR sey yazilmaz veya gonderilmez. */
export const TELEMETRY_EVENTS = ['app.start', 'timeline.open', 'chain.seen', 'rules.saved', 'lab.start', 'report.export', 'demo.open', 'palette.open'] as const
export type TelemetryEvent = (typeof TELEMETRY_EVENTS)[number]

/** Yalnizca kisa sayi/bool/etiket; URL, yol veya serbest metin olamaz. */
export function sanitizeProps(props: Record<string, unknown> | undefined): Record<string, string | number | boolean> {
  const out: Record<string, string | number | boolean> = {}
  for (const [k, v] of Object.entries(props ?? {})) {
    if (typeof v === 'number' && Number.isFinite(v)) out[k] = v
    else if (typeof v === 'boolean') out[k] = v
    else if (typeof v === 'string' && v.length <= 40 && /^[\w.-]+$/.test(v)) out[k] = v
  }
  return out
}

export class Telemetry {
  private queue: string[] = []
  private timer: NodeJS.Timeout | null = null
  constructor(private dir: string, private consent: () => string, private installId: () => string, private endpoint: string | undefined = process.env.IZLIX_TELEMETRY_URL) {
    mkdirSync(dir, { recursive: true })
  }

  track(name: TelemetryEvent, props?: Record<string, unknown>): boolean {
    if (this.consent() !== 'granted' || !TELEMETRY_EVENTS.includes(name)) return false
    const line = JSON.stringify({ t: Date.now(), id: this.installId(), name, props: sanitizeProps(props) })
    try { appendFileSync(join(this.dir, 'telemetry.ndjson'), line + '\n') } catch { /* yerel kayit basarisiz: sessizce vazgec */ }
    if (this.endpoint) { this.queue.push(line); this.schedule() }
    return true
  }

  private schedule(): void {
    if (this.timer) return
    this.timer = setTimeout(() => { this.timer = null; void this.flush() }, 60_000)
  }
  async flush(): Promise<void> {
    if (!this.endpoint || !this.queue.length || this.consent() !== 'granted') { this.queue = []; return }
    const batch = this.queue.splice(0)
    try { await fetch(this.endpoint, { method: 'POST', headers: { 'content-type': 'application/x-ndjson' }, body: batch.join('\n') }) } catch { /* ag yok: veri yerelde kaldi */ }
  }
}
