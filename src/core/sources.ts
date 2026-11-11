import type { SrcLoc } from './types'
import type { CdpClient } from './cdp-client'
import { base64ToUtf8 } from './util'
import { TraceMap, FlattenMap, originalPositionFor, allGeneratedPositionsFor } from '@jridgewell/trace-mapping'

export type { SrcLoc }

/** Platform katmani: dosya sistemi/ag/yol islemleri host'a birakilir (Electron: Node + oturum fetch'i; eklenti: fetch + yol sezgisi) */
export interface SourceHost {
  /** betik/source map metnini indir */
  fetchText(url: string): Promise<string>
  /** sekme/sayfa hala yasiyor mu */
  alive(): boolean
  /** dosya var mi (bilinmiyorsa undefined: kok-gorelı yollar kok ile birlestirilir) */
  exists?(path: string): boolean
  /** yol birlestir */
  join(root: string, rel: string): string
  /** dosya, kok klasorun ALTINDA mi (yol gecisi cozulerek) */
  isInside(root: string, file: string): boolean
}

/** Duz harita (Vite/webpack) veya indeksli/bolumlu harita (Next.js Turbopack: `sections`) */
export function parseSourceMap(text: string, url: string): TraceMap {
  const json = JSON.parse(text)
  return Array.isArray(json.sections) ? (new FlattenMap(json, url) as unknown as TraceMap) : new TraceMap(json, url)
}

interface Script { scriptId: string; url: string; sourceMapURL?: string; map?: Promise<TraceMap | null> }

const SKIP = /\/node_modules\/|\/\.vite\/|^chrome-extension:|^devtools:/

// Source map cozumleme: scriptId + (satir, sutun) -> orijinal dosya:satir.
// Component konumu: Runtime.getProperties -> [[FunctionLocation]] (React 19'da _debugSource yok).
export class SourceResolver {
  private scripts = new Map<string, Script>() // scriptId -> Script (yalnizca Debugger penceresi acikken)
  private byUrl = new Map<string, Script>()
  private flushTimer: ReturnType<typeof setTimeout> | null = null
  private flushing: Promise<void> | null = null
  private queue = new Map<number, { name: string; resolve: (l: SrcLoc | null) => void }>()
  private typeLoc = new Map<number, Promise<SrcLoc | null>>()
  private pending = new Set<Promise<unknown>>()
  /** Debugger paneli acikken Debugger alani acik kalir: gecici enable/disable penceresi kapatmaz */
  holdDebugger = false
  readonly knownFiles = new Set<string>() // editor'e acilmasina izin verilen dosyalar
  readonly components = new Map<number, SrcLoc & { name: string }>()

  /** Workspace kok klasoru: kok-gorelı source map yollarini (/src/App.tsx) mutlak yapar */
  root: string | null = null
  /** Kok klasoru tembel bulur (dev sunucusu sonradan algilanabilir); once root, yoksa bu */
  rootProvider: (() => string | null) | null = null

  constructor(private client: CdpClient, private host: SourceHost) {
    client.onEvent((method, p: any) => {
      if (method === 'Debugger.scriptParsed') {
        const sc: Script = this.byUrl.get(p.url) ?? { scriptId: p.scriptId, url: p.url }
        sc.scriptId = p.scriptId
        if (p.sourceMapURL) sc.sourceMapURL = p.sourceMapURL
        this.scripts.set(p.scriptId, sc)
        if (p.url) this.byUrl.set(p.url, sc)
      }
    })
  }

  private track<T>(p: Promise<T>): Promise<T> {
    this.pending.add(p)
    void p.finally(() => this.pending.delete(p)).catch(() => {})
    return p
  }
  async settled(): Promise<void> {
    while (this.pending.size || this.flushTimer || this.flushing) {
      await Promise.allSettled([...this.pending])
      await new Promise((r) => setTimeout(r, 20))
    }
  }

  private loadMap(s: Script): Promise<TraceMap | null> {
    s.map ??= (async () => {
      if (SKIP.test(s.url)) return null
      try {
        if (!s.sourceMapURL && s.url) {
          const code = await this.host.fetchText(s.url)
          s.sourceMapURL = code.match(/\/\/# sourceMappingURL=(\S+)\s*$/)?.[1]
        }
        if (!s.sourceMapURL) return null
        let text: string
        if (s.sourceMapURL.startsWith('data:')) {
          const comma = s.sourceMapURL.indexOf(',')
          const meta = s.sourceMapURL.slice(0, comma)
          const body = s.sourceMapURL.slice(comma + 1)
          text = meta.includes(';base64') ? base64ToUtf8(body) : decodeURIComponent(body)
        } else {
          text = await this.host.fetchText(new URL(s.sourceMapURL, s.url).href)
        }
        return parseSourceMap(text, s.url)
      } catch { return null }
    })()
    return s.map
  }

  /** CDP konumu (0-bazli) -> orijinal kaynak konumu */
  async resolveFrame(scriptId: string | undefined, line0: number, col0: number, url?: string): Promise<SrcLoc | null> {
    let s = (url ? this.byUrl.get(url) : undefined) ?? (scriptId ? this.scripts.get(scriptId) : undefined)
    if (!s && url) { s = { scriptId: scriptId ?? '', url }; this.byUrl.set(url, s) }
    if (!s) return null
    const map = await this.loadMap(s)
    if (!map) return null
    const o = originalPositionFor(map, { line: line0 + 1, column: col0 })
    if (!o.source || o.line == null) return null
    const file = this.normalize(o.source)
    if (SKIP.test(file)) return null
    this.knownFiles.add(file)
    return { file, line: o.line, column: (o.column ?? 0) + 1 }
  }

  private normalize(src: string): string {
    // Vite: mutlak dosya yolu. http(s)://host/src/x.tsx gibi ise yol kismini birakir (Next/webpack icin 4. adim)
    let path = /^https?:\/\//.test(src) ? new URL(src).pathname : src.replace(/^file:\/\//, '').split('?')[0]
    path = decodeURIComponent(path)
    if (path.startsWith('/@fs/')) path = path.slice(4)
    const root = this.root ?? this.rootProvider?.() ?? null
    if (root) {
      if (this.host.exists) {
        if (!this.host.exists(path)) { const abs = this.host.join(root, path); if (this.host.exists(abs)) return abs }
      } else if (!this.host.isInside(root, path)) return this.host.join(root, path) // dosya sistemi yok: kok disindaki yol kok-goreli sayilir
    }
    return path
  }

  /** Hassas mod: bilesenin konumu derleme zamaninda eklenmis ("dosya:satir:sutun"); source map cozumlemesi atlanir. */
  setPrecise(typeId: number, name: string, spec: string): SrcLoc | null {
    const m = /^(.*):(\d+):(\d+)$/.exec(spec)
    if (!m || this.typeLoc.has(typeId)) return this.components.get(typeId) ?? null
    // sayfa kontrollu veri: yalnizca guvenilir proje kokunun altindaki yollar kabul edilir
    const root = this.root ?? this.rootProvider?.() ?? null
    if (!root || !this.host.isInside(root, m[1])) return null
    const loc: SrcLoc = { file: m[1], line: Number(m[2]), column: Number(m[3]) }
    this.typeLoc.set(typeId, Promise.resolve(loc))
    this.components.set(typeId, { ...loc, name })
    this.knownFiles.add(loc.file)
    return loc
  }

  /** React tip kimligi -> bilesenin tanimlandigi yer. Konum yalnizca Debugger penceresinde (scriptId->url) cozulebilir;
   *  bu yuzden istekler kuyruga alinir ve sayfa bosken tek seferde cozulur (sayfa yuklemesine yuk bindirmez). */
  resolveType(typeId: number, name: string): Promise<SrcLoc | null> {
    let p = this.typeLoc.get(typeId)
    if (!p) {
      p = this.track(new Promise<SrcLoc | null>((resolve) => this.queue.set(typeId, { name, resolve })))
      this.typeLoc.set(typeId, p)
      this.scheduleFlush()
    }
    return p
  }

  private scheduleFlush(delayMs = this.flushDelayMs): void {
    if (this.flushTimer) clearTimeout(this.flushTimer)
    this.flushTimer = setTimeout(() => {
      this.flushTimer = null
      this.flushing = this.flushQueue().finally(() => { this.flushing = null })
    }, delayMs)
  }
  flushDelayMs = 600

  private async flushQueue(): Promise<void> {
    const batch = [...this.queue.entries()]
    this.queue.clear()
    if (!batch.length) return
    if (!this.host.alive()) { for (const [, q] of batch) q.resolve(null); return } // sekme kapanmis
    const dbg = { sendCommand: (m: string, p?: object) => this.client.send(m, p) }
    try {
      await dbg.sendCommand('Debugger.enable') // scriptParsed tekrari: scriptId -> url
      for (const [typeId, { name, resolve }] of batch) {
        try {
          const ev: any = await dbg.sendCommand('Runtime.evaluate', { expression: `window.__IZLIX_TYPE__(${typeId})` })
          const objectId = ev.result?.objectId
          if (!objectId) { resolve(null); continue }
          const props: any = await dbg.sendCommand('Runtime.getProperties', { objectId, ownProperties: true })
          const loc = props.internalProperties?.find((x: any) => x.name === '[[FunctionLocation]]')?.value?.value
          void dbg.sendCommand('Runtime.releaseObject', { objectId }).catch(() => {})
          const src = loc ? await this.resolveFrame(loc.scriptId, loc.lineNumber, loc.columnNumber, this.scripts.get(loc.scriptId)?.url) : null
          if (src) this.components.set(typeId, { ...src, name })
          resolve(src)
        } catch { resolve(null) }
      }
    } finally {
      if (!this.holdDebugger) {
        if (this.host.alive()) await dbg.sendCommand('Debugger.disable').catch(() => {})
        this.scripts.clear()
      }
    }
  }

  /** Yuklenmis betik adresleri (scriptId bilinen) */
  scriptUrls(): string[] { return [...this.byUrl.keys()].filter(Boolean) }
  scriptIdOf(url: string): string | undefined { return this.byUrl.get(url)?.scriptId }

  /**
   * Orijinal kaynak konumu (dosya adi, 1-bazli satir) -> uretilen betik konumu (url, 0-bazli satir/sutun).
   * Tum yuklu betiklerin source map'lerine bakar; kaynak adi `endsWith` ile eslenir.
   */
  async generatedFor(name: string, line: number, col = 0): Promise<{ url: string; line0: number; col0: number } | null> {
    const base = name.replace(/\\/g, '/').replace(/^\.?\//, '')
    for (const sc of this.byUrl.values()) {
      if (!sc.url) continue
      const map = await this.loadMap(sc)
      if (!map) continue
      const src = (map.sources as (string | null)[]).find((x) => !!x && decodeURIComponent(x).replace(/\?.*$/, '').replace(/\\/g, '/').endsWith(base))
      if (!src) continue
      // satirda eslesme yoksa (bos satir/yorum) sonraki birkac satira bak (DevTools gibi)
      for (let l = line; l <= line + 6; l++) {
        const all = allGeneratedPositionsFor(map, { source: src, line: l, column: col })
        const g = all.filter((x) => x.line != null).sort((a, b) => (a.line! - b.line!) || (a.column! - b.column!))[0]
        if (g && g.line != null && g.column != null) return { url: sc.url, line0: g.line - 1, col0: g.column }
      }
    }
    return null
  }

  /** Ayni dosyada, verilen satirdan once baslayan en yakin bilesen */
  componentAt(file: string, line: number): (SrcLoc & { name: string }) | null {
    let best: (SrcLoc & { name: string }) | null = null
    for (const c of this.components.values()) {
      if (c.file === file && c.line <= line && (!best || c.line > best.line)) best = c
    }
    return best
  }

  /** CDP stackTrace (parent zinciri dahil) -> uygulama koduna ait ilk kare */
  async firstAppFrame(stack: any): Promise<SrcLoc | null> {
    for (let st = stack; st; st = st.parent) {
      for (const f of st.callFrames ?? []) {
        const r = await this.resolveFrame(f.scriptId, f.lineNumber, f.columnNumber, f.url)
        if (r) return r
      }
    }
    return null
  }
}
