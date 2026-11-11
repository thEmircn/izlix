import type { EventBus } from './bus'
import type { CdpClient } from './cdp-client'
import { utf8ToBase64 } from './util'
import { adPatterns, cdpType, decide, inSet, isLoopbackHost, YOUTUBE_DOC_SCRIPT, type BlockLevel } from '../shared/adblock'
import { evaluate, hostAllowed, needsResponseStage, activeRules, type Decision, type RulesConfig } from '../shared/rules'

const isCrossOriginWrite = (url: string, origin: string | undefined, method: string): boolean => {
  if (!origin || method === 'GET' || method === 'HEAD') return false
  try { return new URL(url).origin !== origin } catch { return false }
}

type Mode = 'off' | 'request' | 'both'
/** Reklam engelleme ayarlari (Interceptor ayni Fetch alanini kullanir: webRequest dinleyicisi yanit-asamasi kurallarini bozuyordu) */
export interface AdHook { cfg: () => { level: BlockLevel; allow: string[]; blockOnDev: boolean }; onBlocked: () => void }

const hdr = (o: Record<string, string>): { name: string; value: string }[] => Object.entries(o).map(([name, value]) => ({ name, value }))

/** Interceptor'un sayfa tutamaci: CDP istemcisi + gecerli adres + sayfa/sekme hala yasiyor mu */
export interface PageHandle { client: CdpClient; url(): string; alive(): boolean }
/** Capraz kaynakli yazma isteklerini mock'lamak icin yerel sunucu (yalniz Electron'da var; yoksa bu istekler degistirilmez) */
export interface MockHost { url(m: { status: number; body: string; contentType: string }): Promise<string> }

/**
 * Request Rules uygulayıcısı (CDP Fetch alanı). İlke "sayfayı gözlemle, bozma":
 * Fetch yalnızca sayfa izinli alan adındayken VE etkin kural varken açılır; aksi halde sayfa Chrome ile aynı çalışır.
 */
export class Interceptor {
  private mode: Mode = 'off'
  private sig = ''
  /** YouTube belge-baslangic betiginin Page.addScript... kimligi (acik ise) */
  private docScriptId: string | null = null
  /** networkId -> uygulanan karar; Timeline'daki istek olayına rozet olarak yazılır */
  private pendingBadges = new Map<string, Decision>()
  private unsub: () => void
  private offEvents: () => void
  private dead = false
  /** gezinme basladiginda hedef adres (getURL() commit'e kadar eskisini verir) */
  private pageUrl: string | null = null

  constructor(private page: PageHandle, private tabId: string, private bus: EventBus, private config: () => RulesConfig, private ad?: AdHook, private mocks?: MockHost) {
    this.offEvents = page.client.onEvent((method, p) => this.onMessage(null, method, p))
    this.unsub = bus.subscribe((ev, change) => {
      if (change !== 'new' || ev.tabId !== tabId || ev.kind !== 'request') return
      const d = this.pendingBadges.get(ev.payload.requestId)
      if (d) { this.pendingBadges.delete(ev.payload.requestId); this.badge(ev.id, d) }
    })
  }

  private send(method: string, params?: object): Promise<any> {
    if (this.dead || !this.page.alive()) return Promise.resolve()
    return this.page.client.send(method, params).catch(() => { /* istek bu arada bitmiş olabilir */ })
  }

  /** Kurallar veya sayfa adresi değişince çağrılır: Fetch alanını gerektiği kadar aç/kapat. */
  setPageUrl(url: string | null): void { this.pageUrl = url }
  private currentUrl(): string { return this.pageUrl ?? this.page.url() }

  async refresh(): Promise<void> {
    if (this.dead || !this.page.alive()) return
    const cfg = this.config()
    const rules = activeRules(cfg)
    const rmode: Mode = rules.length && hostAllowed(this.currentUrl(), cfg.domains) ? (needsResponseStage(rules) ? 'both' : 'request') : 'off'
    const ad = this.adActive()
    await this.syncYoutubeDoc(!!ad && /(^|\.)youtube\.com$/.test(this.hostNow()))
    const sig = `${rmode}|${ad ?? ''}`
    if (sig === this.sig) return
    this.sig = sig; this.mode = rmode
    if (rmode === 'off' && !ad) { await this.send('Fetch.disable'); return }
    // kurallar '*' ile her istegi zaten duraklatir; yalniz reklam varsa sadece reklam kaliplari
    const patterns = rmode === 'off' ? adPatterns(ad!) : [{ urlPattern: '*', requestStage: 'Request' }, ...(rmode === 'both' ? [{ urlPattern: '*', requestStage: 'Response' }] : [])]
    await this.send('Fetch.enable', { patterns })
  }

  /** Bu sayfada reklam engelleme aktifse duzeyi, degilse null (kapali, izinli site, yerel dev sayfasi) */
  private adActive(): BlockLevel | null {
    const c = this.ad?.cfg(); if (!c || c.level === 'off') return null
    let host = ''; try { host = new URL(this.currentUrl()).hostname.toLowerCase() } catch { return null }
    if (!host || (isLoopbackHost(host) && !c.blockOnDev) || inSet(host, new Set(c.allow))) return null
    return c.level
  }

  private hostNow(): string { try { return new URL(this.currentUrl()).hostname.toLowerCase() } catch { return '' } }
  /** YouTube sayfasina gidilirken (reklam engelleme aciksa) reklam verisini silen betik belge baslangicina eklenir; baska sayfada kaldirilir */
  private async syncYoutubeDoc(want: boolean): Promise<void> {
    if (want && !this.docScriptId) {
      await this.send('Page.enable')
      const r = await this.send('Page.addScriptToEvaluateOnNewDocument', { source: YOUTUBE_DOC_SCRIPT })
      this.docScriptId = r?.identifier ?? null
    } else if (!want && this.docScriptId) {
      const id = this.docScriptId; this.docScriptId = null
      await this.send('Page.removeScriptToEvaluateOnNewDocument', { identifier: id })
    }
  }

  private badge(eventId: number, d: Decision): void {
    this.bus.patch(eventId, { modified: { ruleIds: d.ruleIds, kinds: d.kinds, mocked: !!d.mock } })
  }

  private markRequest(networkId: string | undefined, d: Decision): void {
    if (!networkId) return
    const buf = this.bus.snapshot(this.tabId)
    for (let i = buf.length - 1; i >= 0 && i >= buf.length - 300; i--) {
      if (buf[i].kind === 'request' && buf[i].payload.requestId === networkId) { this.badge(buf[i].id, d); return }
    }
    this.pendingBadges.set(networkId, d) // requestWillBeSent henüz gelmedi
    if (this.pendingBadges.size > 200) this.pendingBadges.delete(this.pendingBadges.keys().next().value!)
  }

  private onMessage = (_e: unknown, method: string, p: any): void => {
    if (method === 'Fetch.requestPaused') void this.paused(p)
  }

  private async paused(p: any): Promise<void> {
    const id: string = p.requestId
    const cfg = this.config()
    const rules = activeRules(cfg)
    const allowed = hostAllowed(this.currentUrl(), cfg.domains)
    const req = p.request as { url: string; method: string; headers: Record<string, string> }

    // ---- yanıt aşaması: yalnızca durum kodu değişimi ----
    if (p.responseStatusCode !== undefined || p.responseErrorReason) {
      const d = allowed ? evaluate(rules.filter((r) => r.action.type === 'status'), req) : null
      if (d?.status !== undefined && !p.responseErrorReason) {
        const body = await this.send('Fetch.getResponseBody', { requestId: id })
        await this.send('Fetch.fulfillRequest', {
          requestId: id, responseCode: d.status, responseHeaders: p.responseHeaders ?? [],
          body: body ? (body.base64Encoded ? body.body : utf8ToBase64(body.body)) : ''
        })
        this.markRequest(p.networkId, evaluate(rules, req) ?? d) // rozet: isteğe uygulanan tüm kurallar
      } else await this.send('Fetch.continueResponse', { requestId: id })
      return
    }

    // ---- istek aşaması ----
    const c = this.ad?.cfg()
    if (c && this.adActive() && decide(req.url, cdpType(p.resourceType, req.url === this.currentUrl()), this.currentUrl(), { level: c.level, allow: c.allow, blockOnDev: c.blockOnDev })) {
      this.ad!.onBlocked(); await this.send('Fetch.failRequest', { requestId: id, errorReason: 'BlockedByClient' }); return
    }
    if (!allowed) { await this.send('Fetch.continueRequest', { requestId: id }); return }
    const origin = req.headers?.Origin ?? req.headers?.origin
    const cors = (extra: Record<string, string> = {}): { name: string; value: string }[] => hdr({
      'Access-Control-Allow-Origin': origin ?? '*',
      'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', ...extra
    })

    // CORS ön kontrolü: mock'lanan bir adrese gidiyorsa, tarayıcının mock yanıtına izin vermesi için onaylanır
    if (req.method === 'OPTIONS' && (req.headers?.['Access-Control-Request-Method'] ?? req.headers?.['access-control-request-method'])) {
      const pre = evaluate(rules, req, { ignoreMethod: true })
      if (pre?.mock) { await this.send('Fetch.fulfillRequest', { requestId: id, responseCode: 204, responseHeaders: cors(), body: '' }); return }
    }

    const d = evaluate(rules, req)
    if (d?.block) {
      if (d.delayMs > 0) await new Promise((r) => setTimeout(r, d.delayMs))
      this.markRequest(p.networkId, d)
      await this.send('Fetch.failRequest', { requestId: id, errorReason: 'BlockedByClient' })
      return
    }
    if (!d || d.kinds.every((k) => k === 'status')) {
      await this.send('Fetch.continueRequest', { requestId: id }) // yalnızca durum kuralı: yanıt aşamasında uygulanır
      return
    }
    if (d.delayMs > 0) await new Promise((r) => setTimeout(r, d.delayMs))
    this.markRequest(p.networkId, d)

    if (d.mock && isCrossOriginWrite(req.url, origin, req.method)) {
      // Chromium bu durumda fulfillRequest ile cokuyor: yerel mock sunucusuna yonlendir (sunucu yoksa istek degistirilmeden gecer)
      if (this.mocks) await this.send('Fetch.continueRequest', { requestId: id, url: await this.mocks.url({ ...d.mock, status: d.status ?? d.mock.status }) })
      else await this.send('Fetch.continueRequest', { requestId: id })
      return
    }
    if (d.mock) {
      await this.send('Fetch.fulfillRequest', {
        requestId: id, responseCode: d.status ?? d.mock.status, body: utf8ToBase64(d.mock.body),
        responseHeaders: cors({ 'Content-Type': d.mock.contentType, 'X-Izlix-Mock': '1' })
      })
      return
    }
    const params: Record<string, unknown> = { requestId: id }
    if (d.redirectTo) params.url = d.redirectTo
    if (Object.keys(d.setHeaders).length || d.removeHeaders.length) {
      const drop = new Set([...d.removeHeaders, ...Object.keys(d.setHeaders)].map((h) => h.toLowerCase()))
      params.headers = [...hdr(req.headers ?? {}).filter((h) => !drop.has(h.name.toLowerCase())), ...hdr(d.setHeaders)]
    }
    await this.send('Fetch.continueRequest', params)
  }

  detach(): void {
    this.dead = true
    this.unsub()
    this.offEvents()
  }
}
