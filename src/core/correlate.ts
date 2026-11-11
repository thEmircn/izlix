import type { BusEvent } from '../shared/events'
import type { EventBus } from './bus'
import type { SrcLoc } from './types'

/** Korelatorun ihtiyac duydugu kaynak cozumleme yuzeyi (testte taklit edilebilir) */
export interface SourceLookup {
  settled(): Promise<void>
  resolveType(typeId: number, name: string): Promise<SrcLoc | null>
  setPrecise?(typeId: number, name: string, spec: string): SrcLoc | null
  components: Map<number, SrcLoc & { name: string }>
  firstAppFrame(stack: any): Promise<SrcLoc | null>
  componentAt(file: string, line: number): (SrcLoc & { name: string }) | null
}

// Nedensellik baglari (plan bolum 4). Her bag KESIN veya TAHMINI isaretlenir.
//  girdi  -> state/render : KESIN   (commit, girdi olayiyla ayni gorevde)
//  girdi  -> istek        : KESIN   (fetch cagrisi girdi isleyicisinde)
//  istek  -> component    : KESIN   (initiator stack + source map -> bilesen)  [payload.origin]
//  istek  -> yanit        : KESIN   (requestId)
//  yanit  -> render       : TAHMINI (zaman penceresi)
//  render -> hata         : KESIN   (hata stack'indeki bilesen commit kaydinda) / yoksa TAHMINI
const RESPONSE_RENDER_WINDOW_MS = 1000
const ERROR_RENDER_WINDOW_MS = 10_000
const HMR_RENDER_WINDOW_MS = 3000 // HMR bildirimi ile yeniden render arasi

interface Commit { evId: number; ts: number; names: Set<string> }

export class Correlator {
  private inputByPageId = new Map<number, number>()
  private fetchInputs = new Map<string, number[]>() // url -> girdi page-id kuyrugu
  private requestByCdpId = new Map<string, number>()
  private responses: { evId: number; ts: number; used: boolean }[] = []
  private commits: Commit[] = []
  private hmrs: { evId: number; ts: number; used: boolean }[] = []

  /** Her sekmenin kendi korelatoru vardir; yalnizca kendi sekmesinin olaylarini isler. */
  constructor(private bus: EventBus, private src: SourceLookup, private tabId?: string) {
    bus.subscribe((ev, change) => { if (change === 'new' && (this.tabId === undefined || ev.tabId === this.tabId)) this.onEvent(ev) })
  }

  /** koprudeki fetch cagrisi (CDP request'iyle URL uzerinden eslesir) */
  onFetchStart(url: string, inputId: number | null): void {
    if (inputId == null) return
    const q = this.fetchInputs.get(url) ?? []
    q.push(inputId)
    this.fetchInputs.set(url, q)
  }

  private onEvent(ev: BusEvent): void {
    const p = ev.payload
    switch (ev.source) {
      case 'bridge:input':
        this.inputByPageId.set(p.inputId, ev.id)
        break
      case 'cdp:Network.requestWillBeSent': {
        this.requestByCdpId.set(p.requestId, ev.id)
        const pageInput = this.fetchInputs.get(p.url)?.shift()
        const inputEv = pageInput != null ? this.inputByPageId.get(pageInput) : undefined
        if (inputEv != null) this.bus.link(ev.id, inputEv, 'exact', 'input→request')
        void this.resolveOrigin(ev, p.initiator?.stack)
        break
      }
      case 'cdp:Network.responseReceived': {
        const reqEv = this.requestByCdpId.get(p.requestId)
        if (reqEv != null) this.bus.link(ev.id, reqEv, 'exact', 'request→response')
        if (p.type === 'Fetch' || p.type === 'XHR') this.responses.push({ evId: ev.id, ts: ev.ts, used: false })
        break
      }
      case 'bridge:commit':
        this.onCommit(ev)
        break
      case 'hmr:vite':
      case 'hmr:next':
        if (p.action !== 'rebuilding') { this.hmrs.push({ evId: ev.id, ts: ev.ts, used: false }); if (this.hmrs.length > 50) this.hmrs.shift() }
        break
      case 'cdp:Runtime.exceptionThrown':
        void this.onError(ev)
        break
    }
  }

  private onCommit(ev: BusEvent): void {
    const p = ev.payload
    const inputEv = p.inputId != null ? this.inputByPageId.get(p.inputId) : undefined
    if (p.inputId != null) {
      // girdi gorevinde commit edildi: girdiye bagli (olay tampondan dusmusse bag yok), yanita ASLA baglanmaz
      if (inputEv != null) this.bus.link(ev.id, inputEv, 'exact', 'input→state')
    } else {
      // girdiyle tetiklenmediyse: once HMR (dosya kaydi -> yeniden render), sonra son islenmemis fetch yaniti (tahmini)
      const h = [...this.hmrs].reverse().find((x) => !x.used && ev.ts >= x.ts - 50 && ev.ts - x.ts <= HMR_RENDER_WINDOW_MS)
      if (h) { h.used = true; this.bus.link(ev.id, h.evId, 'estimated', 'hmr→render') }
      const r = h ? undefined : [...this.responses].reverse().find((x) => !x.used && ev.ts - x.ts <= RESPONSE_RENDER_WINDOW_MS)
      if (r) { r.used = true; this.bus.link(ev.id, r.evId, 'estimated', 'response→render') }
    }
    this.commits.push({ evId: ev.id, ts: ev.ts, names: new Set((p.components ?? []).map((c: any) => c.name)) })
    if (this.commits.length > 500) this.commits.shift()
    void this.resolveComponents(ev)
  }

  private async resolveComponents(ev: BusEvent): Promise<void> {
    const comps: any[] = ev.payload.components ?? []
    const seen = new Set<number>()
    await Promise.all(comps.map(async (c) => {
      if (c.t == null || seen.has(c.t)) return
      seen.add(c.t)
      if (c.src && this.src.setPrecise?.(c.t, c.name, c.src)) return // hassas mod: konum derleme zamaninda biliniyor
      await this.src.resolveType(c.t, c.name)
    }))
    const resolved = comps.map((c) => {
      const loc = c.t != null ? this.src.components.get(c.t) : undefined
      return loc ? { ...c, file: loc.file, line: loc.line } : c
    })
    this.bus.patch(ev.id, { components: resolved })
  }

  /** istek/hata kaynagi: stack -> orijinal dosya:satir + bilesen */
  private async resolveOrigin(ev: BusEvent, stack: any): Promise<void> {
    if (!stack) return
    await this.src.settled()
    const loc = await this.src.firstAppFrame(stack)
    if (!loc) return
    const comp = this.src.componentAt(loc.file, loc.line)
    this.bus.patch(ev.id, { origin: { ...loc, component: comp?.name } })
  }

  private async onError(ev: BusEvent): Promise<void> {
    await this.src.settled()
    const loc = await this.src.firstAppFrame(ev.payload.stackTrace)
    if (!loc) return
    const comp = this.src.componentAt(loc.file, loc.line)
    this.bus.patch(ev.id, { origin: { ...loc, component: comp?.name } })
    const recent = this.commits.filter((c) => c.ts <= ev.ts && ev.ts - c.ts <= ERROR_RENDER_WINDOW_MS)
    const exact = comp ? [...recent].reverse().find((c) => c.names.has(comp.name)) : undefined
    if (exact) this.bus.link(ev.id, exact.evId, 'exact', 'render→error')
    else if (recent.length) this.bus.link(ev.id, recent[recent.length - 1].evId, 'estimated', 'render→error')
  }
}
