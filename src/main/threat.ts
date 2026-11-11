import { app, net } from 'electron'
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { domainToUnicode } from 'node:url'
import { parseHostList, threatOf } from '../shared/threat'

const FEED = 'https://urlhaus.abuse.ch/downloads/hostfile/'
const MAX_AGE = 12 * 3600_000

/** Zararli alan adi listesi (URLhaus, CC0): onbellekli, 12 saatte bir yenilenir; istek yalniz genel bir liste indirir (kullanici verisi gitmez). */
export class ThreatService {
  private set = new Set<string>()
  private trusted = new Set<string>()
  private file: string
  constructor(dir = app.getPath('userData')) { mkdirSync(dir, { recursive: true }); this.file = process.env.DB_THREAT_LIST ?? join(dir, 'threat-hosts.txt'); this.loadFile() }
  private loadFile(): void { try { if (existsSync(this.file)) this.set = parseHostList(readFileSync(this.file, 'utf8')) } catch { /* bozuk dosya: bos liste */ } }
  get size(): number { return this.set.size }
  /** acilista ve periyodik: eskiyse indirir; ag/hata sessizce atlanir */
  async refresh(force = false): Promise<void> {
    if (process.env.DB_THREAT_LIST) return
    try { if (!force && existsSync(this.file) && Date.now() - statSync(this.file).mtimeMs < MAX_AGE) return } catch { /* yok say */ }
    try {
      const r = await net.fetch(FEED, { headers: { 'user-agent': 'Izlix' } }); if (!r.ok) return
      const text = await r.text(); const s = parseHostList(text); if (s.size < 10) return // bos/bozuk yanit mevcut listeyi ezmesin
      writeFileSync(this.file, text); this.set = s
    } catch { /* cevrimdisi */ }
  }
  trust(host: string): void { this.trusted.add(host) }
  check(url: string): { kind: 'malware' | 'lookalike' | 'idn'; host: string; brand?: string } | null {
    let host = ''; try { host = new URL(url).hostname } catch { return null }
    if (this.trusted.has(host)) return null
    return threatOf(url, this.set, host.includes('xn--') ? domainToUnicode(host) : undefined)
  }
}
