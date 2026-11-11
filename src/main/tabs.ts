import { BrowserWindow, WebContentsView, session, app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import type { TabInfo, DevToolsDock } from '../shared/events'
import { computeLayout, padRect, CARD_RADIUS, GAP, type LayoutParams, type Rect } from '../shared/layout'
import { isAllowedPageNavigation, resolveInput } from '../shared/url'
import { cleanTrackingParams } from '../shared/tracking'
import { attachCdp, type Tab } from './cdp'
import type { EventBus } from './bus'
import { partitionFor, type WorkspaceStore } from './workspace'
import { Interceptor } from './interceptor'
import { Lab } from './lab'
import { errorPageHtml, shouldRetry } from './errorpage'
import { isLoopbackHost } from './security'
import { deviceById, type Device } from '../shared/lab'
import type { RulesConfig } from '../shared/rules'
import { emulationCommands, geoPreset, mediaFeatures, uaPreset, VISION, type Contrast, type Emu } from '../shared/emulation'

export const INCOGNITO_PARTITION = 'incog-main'
export const TOR_PARTITION = 'tor-main'

/** son gizli sekme kapaninca cerez, depolama ve onbellek silinir */
async function wipeIncognito(part: string): Promise<void> {
  const ses = session.fromPartition(part)
  await ses.clearStorageData().catch(() => {}); await ses.clearCache().catch(() => {}); await ses.clearAuthCache().catch(() => {})
}

/** Bir pencerenin gorunum durumu */
export interface WinCtx { id: number; win: BrowserWindow; activeId: string | null; split: { a: string; b: string } | null; layoutParams: LayoutParams; overlayOpen: boolean }

interface Entry {
  /** sekmenin gosterildigi pencere (WinCtx.id) */
  winId: number
  /** son aktif olma zamani (otomatik uyutma icin) */
  lastActive: number
  info: TabInfo
  view: WebContentsView
  cdp?: Tab
  interceptor?: Interceptor
  lab?: Lab
  /** DevTools gorunumu lab'da da birincil gorunumle birlikte kalir */
  devtools?: WebContentsView
  /** son bilinen http(s) adresi: sayfa commit olmadan (about:blank) gelen cozumlemeler icin yedek */
  lastHttpUrl?: string
  retryTimer?: NodeJS.Timeout
  failedUrl?: string
}

/** Sekme yoneticisi: her sekme ayri WebContentsView; oturum Workspace basina ayri bolum (cerez/depolama izolasyonu). */
export class TabManager {
  private tabs = new Map<string, Entry>()
  private order: string[] = []
  /** Pencere baglamlari: her pencerenin kendi aktif sekmesi, bolunmus gorunumu ve yerlesimi vardir; sekme havuzu ortaktir. */
  private ctxs = new Map<number, WinCtx>()
  /** Gecerli pencere baglami: IPC cagrisi gonderen pencereye, sekme islemleri sekmenin penceresine ayarlanir (senkron kesitlerde) */
  private cur!: WinCtx
  private get win(): BrowserWindow { return this.cur.win }
  private get activeId(): string | null { return this.cur.activeId }
  private set activeId(v: string | null) { this.cur.activeId = v }
  /** Bolunmus gorunum: iki sekme yan yana (a solda, b sagda); aktif sekme ikisinden biridir. */
  private get split(): { a: string; b: string } | null { return this.cur.split }
  private set split(v: { a: string; b: string } | null) { this.cur.split = v }
  private get overlayOpen(): boolean { return this.cur.overlayOpen }
  private set overlayOpen(v: boolean) { this.cur.overlayOpen = v }
  private get layoutParams(): LayoutParams { return this.cur.layoutParams }
  private set layoutParams(v: LayoutParams) { this.cur.layoutParams = v }
  private seq = 0
  private closed: { url: string; workspaceId: string }[] = []

  constructor(win: BrowserWindow, private bus: EventBus, private workspaces: WorkspaceStore, private onChange: () => void,
    /** sayfanin dev sunucusunun proje kokunu bulur (Workspace kokunun yoksa port -> cwd) */
    private rootFor: (url: string, workspaceId: string) => string | null = () => null,
    /** Workspace'in Request Rules yapilandirmasi */
    private rulesFor: (workspaceId: string) => RulesConfig = () => ({ rules: [], domains: [] }),
    private hooks: { detectedPorts?: () => number[]; language?: () => 'en' | 'tr'; searchEngine?: () => string; torPort?: () => Promise<number | null>; sleepMinutes?: () => number; stripTracking?: () => { on: boolean; dev: boolean }; onFocusWindow?: (win: BrowserWindow) => void; openWindow?: () => Promise<number>; adCfg?: () => { level: 'off' | 'ads' | 'strict'; allow: string[]; blockOnDev: boolean }; onDomReady?: (wc: Electron.WebContents) => void; onFavicons?: (ses: Electron.Session, pageUrl: string, urls: string[]) => void; onThumb?: (url: string, wc: Electron.WebContents) => void; onFound?: (tabId: string, active: number, total: number) => void; onVisit?: (url: string, title: string) => void; onSession?: (ses: Electron.Session) => void } = {}) {
    this.addWindow(win)
    setInterval(() => this.sweep(), 60_000).unref() // hareketsiz sekmeleri uyut
  }

  // ---- coklu pencere: tek sekme havuzu, her sekme tam bir pencerede gosterilir ----
  addWindow(win: BrowserWindow): number {
    const ctx: WinCtx = { id: win.id, win, activeId: null, split: null, layoutParams: { dock: 'off', panelRatio: 0.4, chromeHeight: 84 }, overlayOpen: false }
    this.ctxs.set(ctx.id, ctx)
    if (!this.cur) this.cur = ctx
    win.on('resize', () => this.inWin(ctx.id, () => this.layout()))
    return ctx.id
  }
  /** Pencere kapaninca sekmeleri `fallbackId` penceresine tasir */
  removeWindow(id: number, fallbackId: number): void {
    const ctx = this.ctxs.get(id); if (!ctx || id === fallbackId || !this.ctxs.has(fallbackId)) return
    for (const tid of [...this.order]) if (this.tabs.get(tid)?.winId === id) this.moveToWindow(tid, fallbackId, false)
    this.ctxs.delete(id)
    if (this.cur.id === id) this.cur = this.ctxs.get(fallbackId)!
    this.syncSplitInfo(); this.onChange(); this.persist()
  }
  setCurrent(winId: number): void { const c = this.ctxs.get(winId); if (c) this.cur = c }
  get currentWinId(): number { return this.cur.id }
  windowIds(): number[] { return [...this.ctxs.keys()] }
  /** Pencere baglaminda senkron calistir, sonra eskisine don */
  inWin<T>(winId: number, fn: () => T): T {
    const prev = this.cur, c = this.ctxs.get(winId)
    if (c) this.cur = c
    try { return fn() } finally { this.cur = prev }
  }
  /** `winId` penceresindeki sekmeler (genel sirada) */
  private peers(winId: number): string[] { return this.order.filter((i) => this.tabs.get(i)?.winId === winId) }
  /** Bir pencerenin sekme/gorunum durumu (arayuze gonderilir): tum sekmeler + o pencerenin aktif sekmesi */
  list(winId?: number): { tabs: TabInfo[]; activeId: string | null; win: number; wins: number; dock: DevToolsDock } {
    const c = (winId !== undefined && this.ctxs.get(winId)) || this.cur
    return { tabs: this.order.map((id) => this.tabs.get(id)!.info), activeId: c.activeId, win: c.id, wins: this.ctxs.size, dock: c.layoutParams.dock }
  }
  /** Sekmeyi baska bir pencereye tasir; hedef pencerede aktif olur, kaynak pencerede komsu sekme aktif olur */
  moveToWindow(id: string, target: number, focus = true): boolean {
    const e = this.tabs.get(id), dst = this.ctxs.get(target)
    if (!e || !dst || e.winId === target) return false
    const src = e.winId
    this.inWin(src, () => {
      if (this.split && (id === this.split.a || id === this.split.b)) { this.split = null; this.syncSplitInfo() }
      if (e.lab) { void e.lab.dispose(); e.lab = undefined; e.info.lab = undefined }
      const wasActive = this.activeId === id
      this.releaseDevTools(e)
      try { this.win.contentView.removeChildView(e.view) } catch { /* zaten cocuk degil */ }
      if (wasActive) this.activeId = null
    })
    e.winId = target; e.info.winId = target
    this.inWin(src, () => { if (!this.activeId) { const next = this.peers(src)[0]; if (next) this.activateIn(next); else this.layout() } })
    this.inWin(target, () => this.activateIn(id))
    if (focus) this.hooks.onFocusWindow?.(dst.win)
    this.onChange(); this.persist()
    return true
  }
  each(fn: (wc: Electron.WebContents) => void): void { for (const e of this.tabs.values()) if (!e.view.webContents.isDestroyed()) fn(e.view.webContents) }
  get(id: string): Entry | undefined { return this.tabs.get(id) }
  active(): Entry | undefined { return this.activeId ? this.tabs.get(this.activeId) : undefined }

  async create(opts: { url?: string; workspaceId: string; winId?: number; activate?: boolean; pinned?: boolean; private?: 'incognito' | 'tor' }): Promise<string> {
    const id = `tab-${++this.seq}`
    // gizli sekmeler tek ortak, bellek ici (persist: yok) oturumu paylasir; son gizli sekme kapaninca temizlenir
    const ses = session.fromPartition(opts.private === 'tor' ? TOR_PARTITION : opts.private ? INCOGNITO_PARTITION : partitionFor(opts.workspaceId))
    if (opts.private === 'tor') {
      // tum trafik yerel Tor SOCKS'una gider (socks5: ad cozumleme de Tor tarafinda); WebRTC sizintisi kapali
      const port = await this.hooks.torPort?.()
      if (!port) throw new Error('tor-unavailable')
      await ses.setProxy({ proxyRules: `socks5://127.0.0.1:${port}` })
    }
    this.hooks.onSession?.(ses)
    // Varsayilan UA'dan "Electron/.." ve uygulama adi cikarilir: bircok site bunlari ayri/engelli davranisa sokar (gercek tarayici gibi gorunsun)
    { const ua = ses.getUserAgent(), clean = ua.replace(/\s+Electron\/[\d.]+/, '').replace(/\s+izlix\/[\w.\-]+/i, ''); if (clean !== ua) ses.setUserAgent(clean) }
    // Sayfa gorunumu: preload yok, sandbox, contextIsolation (plan bolum 4: sayfa hicbir IPC kanalina erisemez)
    const view = new WebContentsView({ webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const winId = opts.winId !== undefined && this.ctxs.has(opts.winId) ? opts.winId : this.cur.id
    const entry: Entry = { winId, lastActive: Date.now(), view, info: { id, winId, workspaceId: opts.workspaceId, title: 'New Tab', url: '', loading: false, canGoBack: false, canGoForward: false, ...(opts.private ? { private: opts.private } : {}), ...(opts.pinned ? { pinned: true } : {}) } }
    this.tabs.set(id, entry); this.order.push(id)
    this.wire(entry)
    // bolunmus gorunumde tiklanan taraf odagi (aktif sekmeyi) alir
    view.webContents.on('focus', () => this.inWin(entry.winId, () => { if (this.split && (id === this.split.a || id === this.split.b) && id !== this.activeId) this.activateIn(id) }))
    if (opts.activate !== false) this.activate(id)

    const wc = view.webContents
    if (opts.private === 'tor') wc.setWebRTCIPHandlingPolicy('disable_non_proxied_udp')
    // CDP: ilk sayfa yuklenmeden komutlar yanit vermez -> about:blank, kurulum, asil sayfa
    await wc.loadURL('about:blank')
    const target = this.tidy(resolveInput(opts.url ?? '', this.hooks.searchEngine?.()))
    if (/^https?:/.test(target)) entry.lastHttpUrl = target
    entry.cdp = await attachCdp(wc, id, this.bus, () => {
      const u = wc.getURL()
      return this.rootFor(/^https?:/.test(u) ? u : entry.lastHttpUrl ?? u, opts.workspaceId)
    })
    entry.interceptor = new Interceptor(wc, id, this.bus, () => this.rulesFor(opts.workspaceId), this.adHook(wc))
    await entry.interceptor.refresh()
    if (target !== 'about:blank') void wc.loadURL(target).catch(() => {})
    this.persist()
    return id
  }

  private wire(e: Entry): void {
    const wc = e.view.webContents
    const sync = (): void => {
      if (wc.isDestroyed() || e.view.webContents !== wc) return // uyutulmus/degistirilmis gorunumun gec olaylari
      if (/^https?:/.test(wc.getURL())) e.lastHttpUrl = wc.getURL()
      Object.assign(e.info, {
        title: wc.getURL() === 'about:blank' ? 'New Tab' : wc.getTitle() || e.info.title, url: wc.getURL() === 'about:blank' ? '' : wc.getURL(), loading: wc.isLoading(),
        canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward()
      })
      this.onChange()
    }
    wc.on('dom-ready', () => this.hooks.onDomReady?.(wc))
    wc.on('did-start-navigation', (d: any) => {
      if (!d.isMainFrame || d.isSameDocument) return
      if (e.info.blocked) { e.info.blocked = 0; this.onChange() }
      e.interceptor?.setPageUrl(d.url); void e.interceptor?.refresh()
    })
    wc.on('did-navigate', () => { e.interceptor?.setPageUrl(null); void e.interceptor?.refresh() })
    for (const ev of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated'] as const) wc.on(ev as any, sync)
    wc.on('did-stop-loading', () => { this.persist(); if (!e.info.private) this.hooks.onVisit?.(wc.getURL(), wc.getTitle()); this.scheduleThumb(e) })
    wc.on('page-favicon-updated', (_ev, urls) => { if (!e.info.private) this.hooks.onFavicons?.(wc.session, wc.getURL(), urls) })
    wc.on('page-title-updated', () => { if (!e.info.private) this.hooks.onVisit?.(wc.getURL(), wc.getTitle()) })
    // Cokme sonrasi kurtarma: render sureci olurse sekme yeniden yuklenir
    wc.on('render-process-gone', (_ev, d) => { if (d.reason !== 'clean-exit') setTimeout(() => { if (!wc.isDestroyed()) wc.reload() }, 300) })
    // target=_blank ve window.open: yeni sekmede ac (ayni Workspace)
    wc.setWindowOpenHandler(({ url }) => { if (isAllowedPageNavigation(url)) void this.create({ url, workspaceId: e.info.workspaceId, private: e.info.private }); return { action: 'deny' } })
    // sayfa kaynakli gezinmeler de http(s) ile sinirli (file://, izlix://, vscode:// vb. engellenir)
    const guard = (event: Electron.Event, url: string): void => { if (!isAllowedPageNavigation(url)) event.preventDefault() }
    // Yukleme hatasi: aciklayici sayfa; loopback adreslerinde sunucu acilana kadar otomatik yeniden dene
    wc.on('did-fail-load', (_ev, code, desc, url, isMain) => {
      if (!isMain || code === -3 || wc.isDestroyed()) return // -3: kullanici iptali / yeni gezinme
      e.failedUrl = url
      const retry = shouldRetry(url, isLoopbackHost)
      void wc.executeJavaScript(`document.documentElement.innerHTML = ${JSON.stringify(errorPageHtml(url, code, desc, this.hooks.detectedPorts?.() ?? [], this.hooks.language?.() ?? 'en', retry))}`).catch(() => {})
      if (retry && !e.retryTimer) {
        e.retryTimer = setTimeout(() => { e.retryTimer = undefined; if (!wc.isDestroyed() && e.failedUrl === url) void wc.loadURL(url).catch(() => {}) }, 2000)
      }
    })
    wc.on('did-navigate', () => { e.failedUrl = undefined })
    wc.on('found-in-page', (_ev, r) => this.hooks.onFound?.(e.info.id, r.activeMatchOrdinal, r.matches))
    // izleme parametrelerini (utm_, fbclid...) temizleyip ayni adrese temiz haliyle gec (ana belge gezinmeleri)
    const clean = (event: Electron.Event, url: string): void => {
      const st = this.hooks.stripTracking?.(); if (!st?.on) return
      const c = cleanTrackingParams(url, st.dev)
      if (c !== url) { event.preventDefault(); void wc.loadURL(c).catch(() => {}) }
    }
    wc.on('will-navigate', (ev, url) => { guard(ev, url); if (!ev.defaultPrevented) clean(ev, url) })
    wc.on('will-redirect', (ev, url) => { guard(ev, url); if (!ev.defaultPrevented) clean(ev, url) })
  }

  private adHook(wc: Electron.WebContents): { cfg: NonNullable<ConstructorParameters<typeof Interceptor>[4]>['cfg']; onBlocked: () => void } | undefined {
    const cfg = this.hooks.adCfg; return cfg ? { cfg, onBlocked: () => this.noteBlocked(wc.id) } : undefined
  }
  /** Engellenen istek sayaci (sayfa basina); arayuz en fazla ~3 kez/sn guncellenir */
  private blockTimer: NodeJS.Timeout | null = null
  noteBlocked(webContentsId: number | undefined): void {
    if (webContentsId === undefined) return
    for (const e of this.tabs.values()) if (e.view.webContents.id === webContentsId) { e.info.blocked = (e.info.blocked ?? 0) + 1; break }
    this.blockTimer ??= setTimeout(() => { this.blockTimer = null; this.onChange() }, 350)
  }

  /** Sayfa yuklenince (kullanici gorurken) kucuk bir onizleme goruntusu al; gizli sekme, hata sayfasi ve overlay acikken alinmaz */
  private scheduleThumb(e: Entry): void {
    if (e.info.private || !this.hooks.onThumb) return
    const wc = e.view.webContents, url = wc.getURL()
    if (!/^https?:/.test(url)) return
    setTimeout(() => {
      const c = this.ctxs.get(e.winId)
      if (wc.isDestroyed() || !c || c.activeId !== e.info.id || c.overlayOpen || e.failedUrl || wc.getURL() !== url || wc.isLoading()) return
      this.hooks.onThumb?.(url, wc)
    }, 1500)
  }

  /** Sekmeyi, gosterildigi pencerede aktif eder (baska pencerede ise o pencere one gelir) */
  activate(id: string): void {
    const e = this.tabs.get(id); if (!e) return
    const ctx = this.ctxs.get(e.winId) ?? this.cur
    if (ctx.id !== this.cur.id) { this.inWin(ctx.id, () => this.activateIn(id)); this.hooks.onFocusWindow?.(ctx.win); return }
    this.activateIn(id)
  }
  private activateIn(id: string): void {
    if (!this.tabs.has(id)) return
    if (id === this.activeId) return // zaten aktif: DevTools'u yok edip yeniden kurma
    const waking = this.tabs.get(id)!; if (waking.info.sleeping) this.wake(waking)
    waking.lastActive = Date.now(); const before = this.active(); if (before) before.lastActive = Date.now()
    const prev = this.active()
    // bolunmus ciftin icindeki sekmeye gecis: gorunumler yerinde kalir, yalnizca odak (aktif sekme) degisir
    if (prev && this.split && (id === this.split.a || id === this.split.b)) {
      this.releaseDevTools(prev); this.activeId = id
      const cur = this.tabs.get(id)!
      this.ensureDevTools(cur); this.layout(); this.onChange(); this.persist(); return
    }
    if (prev) {
      // bolunmus cift varsa: aktif sekmenin yuvasi yeni sekmeyle degisir
      if (this.split && prev.info.id === this.split.a) this.split = { a: id, b: this.split.b }
      else if (this.split && prev.info.id === this.split.b) this.split = { a: this.split.a, b: id }
      this.win.contentView.removeChildView(prev.view); prev.lab?.removeViews(); this.releaseDevTools(prev)
      this.syncSplitInfo()
    }
    this.activeId = id
    const cur = this.tabs.get(id)!
    this.win.contentView.addChildView(cur.view)
    cur.lab?.addViews()
    this.ensureDevTools(cur)
    this.layout(); this.onChange(); this.persist()
  }

  /** Pasif sekmenin DevTools'u kapatilir: her DevTools ayri bir renderer sureci (bellek hedefi, plan bolum 10). Tekrar aktif olunca yeniden acilir. */
  private releaseDevTools(e: Entry): void {
    if (!e.devtools) return
    this.win.contentView.removeChildView(e.devtools)
    try { if (!e.view.webContents.isDestroyed()) e.view.webContents.closeDevTools() } catch { /* kapanmis */ }
    if (!e.devtools.webContents.isDestroyed()) e.devtools.webContents.close()
    e.devtools = undefined
  }

  /** DevTools: sekme basina tembel olusur; yalnizca aktif sekmeninki pencerede gorunur */
  private ensureDevTools(e: Entry): void {
    if (this.layoutParams.dock === 'off') return
    if (!e.devtools) {
      e.devtools = new WebContentsView()
      e.view.webContents.setDevToolsWebContents(e.devtools.webContents)
      e.view.webContents.openDevTools()
    }
    this.win.contentView.addChildView(e.devtools)
  }

  setLayout(p: LayoutParams): void {
    const dockChanged = p.dock !== this.layoutParams.dock
    this.layoutParams = p
    const cur = this.active()
    if (cur && dockChanged) {
      if (p.dock === 'off' && cur.devtools) this.releaseDevTools(cur)
      else this.ensureDevTools(cur)
    }
    this.layout()
  }
  get dock(): DevToolsDock { return this.layoutParams.dock }

  layout(): void {
    const cur = this.active()
    if (!cur) return
    const [w, h] = this.win.getContentSize()
    const l = computeLayout(w, h, this.layoutParams)
    const page = padRect(l.page)
    const sp = this.split && !cur.lab ? this.split : null
    const other = sp ? this.tabs.get(cur.info.id === sp.a ? sp.b : sp.a) : null
    if (sp && other) {
      // yan yana: sol ve sag yari (arada GAP boslugu)
      const half = Math.floor((page.width - GAP) / 2)
      const left: Rect = { x: page.x, y: page.y, width: half, height: page.height }, right: Rect = { x: page.x + half + GAP, y: page.y, width: page.width - half - GAP, height: page.height }
      const [ra, rb] = [left, right]
      const va = this.tabs.get(sp.a)!.view, vb = this.tabs.get(sp.b)!.view
      va.setBounds(ra); vb.setBounds(rb)
      for (const v of [va, vb]) try { v.setBorderRadius(CARD_RADIUS) } catch { /* yok say */ }
    } else if (cur.lab) cur.lab.layout(page); else { cur.view.setBounds(page); try { cur.view.setBorderRadius(CARD_RADIUS) } catch { /* eski surum */ } }
    if (cur.devtools && l.devtools) { cur.devtools.setBounds(padRect(l.devtools)); try { cur.devtools.setBorderRadius(CARD_RADIUS) } catch { /* yok say */ } }
  }

  close(id: string): void {
    const e0 = this.tabs.get(id)
    if (!e0) return
    if (e0.winId !== this.cur.id && this.ctxs.has(e0.winId)) { this.inWin(e0.winId, () => this.close(id)); return }
    const e = e0
    const idx = this.order.indexOf(id)
    if (e.info.url && !e.info.private) { this.closed.push({ url: e.info.url, workspaceId: e.info.workspaceId }); if (this.closed.length > 20) this.closed.shift() }
    if (this.split && (id === this.split.a || id === this.split.b)) {
      const partner = this.tabs.get(id === this.split.a ? this.split.b : this.split.a)
      this.split = null; this.syncSplitInfo()
      if (this.activeId === id && partner) this.win.contentView.removeChildView(partner.view) // aktif sekme kapaniyor: ortak gorunum sonradan gerekirse yeniden eklenir
    }
    this.win.contentView.removeChildView(e.view)
    if (e.retryTimer) clearTimeout(e.retryTimer)
    this.releaseDevTools(e)
    void e.lab?.dispose(); e.interceptor?.detach()
    e.cdp?.detach()
    this.bus.dropTab(id)
    e.view.webContents.close()
    this.tabs.delete(id); this.order.splice(idx, 1)
    if (e.info.private && ![...this.tabs.values()].some((t) => t.info.private === e.info.private)) void wipeIncognito(e.info.private === 'tor' ? TOR_PARTITION : INCOGNITO_PARTITION)
    if (this.activeId === id) {
      this.activeId = null
      const mine = this.peers(e.winId) // ayni penceredeki komsu sekme
      const next = mine.find((i) => this.order.indexOf(i) >= idx) ?? mine[mine.length - 1]
      if (next) this.activateIn(next)
    }
    this.layout(); this.onChange(); this.persist()
  }

  async setCacheDisabled(id: string, disabled: boolean): Promise<void> {
    const e = this.tabs.get(id)
    if (!e || e.view.webContents.isDestroyed()) return
    for (const wc of [e.view.webContents, ...(e.lab?.webContents ?? [])]) await wc.debugger.sendCommand('Network.setCacheDisabled', { cacheDisabled: disabled }).catch(() => {})
    e.info.noCache = disabled || undefined
    this.onChange()
  }

  /** Ag/CPU kisitlama ve konum emulasyonu: verilen alanlar guncellenir (null = o ayari sifirla). Lab aciksa tum viewport'lara uygulanir. */
  async setEmulation(id: string, patch: { network?: string | null; cpu?: number | null; geo?: string | null; ua?: string | null; touch?: boolean | null; vision?: string | null; contrast?: Contrast | null; forcedColors?: boolean | null; print?: boolean | null }): Promise<void> {
    const e = this.tabs.get(id)
    if (!e || e.view.webContents.isDestroyed()) return
    const next: Emu = { ...(e.info.emu ?? {}) }
    if ('network' in patch) { if (patch.network) next.network = patch.network; else delete next.network }
    if ('cpu' in patch) { if (patch.cpu && patch.cpu > 1) next.cpu = patch.cpu; else delete next.cpu }
    if ('geo' in patch) { if (patch.geo) next.geo = patch.geo; else delete next.geo }
    if ('ua' in patch) { if (patch.ua && uaPreset(patch.ua)) next.ua = patch.ua; else delete next.ua }
    if ('touch' in patch) { if (patch.touch) next.touch = true; else delete next.touch }
    if ('vision' in patch) { if (patch.vision && (VISION as readonly string[]).includes(patch.vision)) next.vision = patch.vision; else delete next.vision }
    if ('contrast' in patch) { if (patch.contrast === 'more' || patch.contrast === 'less') next.contrast = patch.contrast; else delete next.contrast }
    if ('forcedColors' in patch) { if (patch.forcedColors) next.forcedColors = true; else delete next.forcedColors }
    if ('print' in patch) { if (patch.print) next.print = true; else delete next.print }
    const targets = [e.view.webContents, ...(e.lab?.webContents ?? [])].filter((w, i, a) => a.indexOf(w) === i)
    for (const wc of targets) for (const [m, p] of emulationCommands(next)) await wc.debugger.sendCommand(m, p).catch(() => {})
    e.info.emu = Object.keys(next).length ? next : undefined
    await this.sendMedia(e)
    this.onChange()
  }
  /** Konum izni: yalnizca konum emulasyonu acik sekmede verilir (diger izinler her zaman reddedilir) */
  isGeoEmulated(wc: Electron.WebContents): boolean {
    for (const e of this.tabs.values()) if (e.view.webContents === wc || e.lab?.webContents.includes(wc)) return !!geoPreset(e.info.emu?.geo)
    return false
  }

  /** Emulasyon: acik/koyu tema, azaltilmis hareket. Lab aciksa tum viewport'lara uygulanir. */
  async setMedia(id: string, colorScheme: 'light' | 'dark' | null, reducedMotion: boolean): Promise<void> {
    const e = this.tabs.get(id)
    if (!e || e.view.webContents.isDestroyed()) return
    e.info.media = colorScheme || reducedMotion ? { colorScheme: colorScheme ?? undefined, reducedMotion: reducedMotion || undefined } : undefined
    await this.sendMedia(e)
    this.onChange()
  }
  /** Medya ozellikleri (renk semasi, hareket, karsitlik, zorunlu renk) + yazdirma ortami: tek cagri; Lab goruntulerine de uygulanir. */
  private async sendMedia(e: Entry): Promise<void> {
    const { features, mediaType } = mediaFeatures(e.info.media, e.info.emu)
    await e.view.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { media: mediaType, features }).catch(() => {})
    if (e.lab) { e.lab.media = features; await e.lab.applyMedia(features) }
  }

  /** Responsive Lab: cihaz kimlikleri listesi (ilki birincil gorunum); null = kapat */
  async setLab(id: string, ids: string[] | null): Promise<void> {
    const e = this.tabs.get(id)
    if (!e) return
    const devices = (ids ?? []).map(deviceById).filter((d): d is Device => !!d).slice(0, 4)
    if (!devices.length) {
      if (e.lab) { await e.lab.dispose(); e.lab = undefined }
      e.info.lab = undefined
      e.view.setBounds({ x: 0, y: 0, width: 0, height: 0 }); this.layout()
    } else {
      if (!e.lab) {
        e.lab = new Lab(this.ctxs.get(e.winId)?.win ?? this.win, e.view, session.fromPartition(partitionFor(e.info.workspaceId)))
        if (e.info.media) e.lab.media = [...(e.info.media.colorScheme ? [{ name: 'prefers-color-scheme', value: e.info.media.colorScheme }] : []), ...(e.info.media.reducedMotion ? [{ name: 'prefers-reduced-motion', value: 'reduce' }] : [])]
      }
      await e.lab.setDevices(devices)
      e.info.lab = devices.map((d) => d.id)
      if (this.activeId === id) e.lab.addViews()
    }
    this.layout(); this.onChange()
  }

  /** Kurallar degisince tum sekmelerde Fetch alanini yeniden degerlendir */
  refreshRules(): void { for (const e of this.tabs.values()) void e.interceptor?.refresh() }
  /** Overlay (palet, kural editoru) acikken sayfa gorunumleri native katman oldugu icin shell'in ustune cikar; gizlenir. */
  setOverlay(open: boolean): void {
    this.overlayOpen = open
    const cur = this.active()
    cur?.view.setVisible(!open); cur?.devtools?.setVisible(!open); cur?.lab?.setVisible(!open)
    if (this.split) for (const id of [this.split.a, this.split.b]) this.tabs.get(id)?.view.setVisible(!open)
  }

  /** Aktif sekmeyi `otherId` ile yan yana gosterir (null: bolmeyi kapat). Responsive Lab acikken bolunmez. */
  setSplit(otherId: string | null): boolean {
    const cur = this.active()
    if (!cur) return false
    if (otherId == null || otherId === cur.info.id) {
      if (!this.split) return true
      const other = this.tabs.get(this.split.a === cur.info.id ? this.split.b : this.split.a)
      this.split = null; if (other) this.win.contentView.removeChildView(other.view)
      this.syncSplitInfo(); this.layout(); this.onChange(); return true
    }
    const other = this.tabs.get(otherId)
    if (!other || cur.lab || other.lab) return false
    if (this.split) { const old = this.tabs.get(this.split.a === cur.info.id ? this.split.b : this.split.a); if (old && old !== other) this.win.contentView.removeChildView(old.view) }
    this.split = { a: cur.info.id, b: otherId }
    this.win.contentView.addChildView(other.view)
    this.syncSplitInfo(); this.layout(); this.onChange(); return true
  }
  get splitIds(): string[] { return this.split ? [this.split.a, this.split.b] : [] }
  private syncSplitInfo(): void {
    for (const e of this.tabs.values()) delete e.info.split
    for (const c of this.ctxs.values()) if (c.split) { const a = this.tabs.get(c.split.a), b = this.tabs.get(c.split.b); if (a) a.info.split = 'left'; if (b) b.info.split = 'right' }
  }

  /** Sekmeyi `toIndex` konumuna tasir (ayni Workspace icinde gorunen sira korunur; genel sira dizisinde yer degistirir) */
  move(id: string, toIndex: number): boolean {
    const from = this.order.indexOf(id)
    if (from < 0) return false
    const to = Math.max(0, Math.min(this.order.length - 1, toIndex))
    if (from === to) return false
    this.order.splice(from, 1); this.order.splice(to, 0, id)
    this.normalizePins()
    this.onChange(); this.persist()
    return true
  }

  // ---- sekme uyutma: sayfa sureci kapanir (bellek), sekme seritte kalir; secilince ayni adresle yeniden yuklenir ----
  private canSleep(e: Entry, manual: boolean): boolean {
    const id = e.info.id
    if (e.info.sleeping || e.info.private || e.lab) return false
    for (const c of this.ctxs.values()) if (c.activeId === id || (c.split && (id === c.split.a || id === c.split.b))) return false
    if (!manual && e.info.pinned) return false
    const wc = e.view.webContents; if (wc.isDestroyed()) return false
    const url = wc.getURL()
    if (!/^https?:/.test(url) || wc.isLoading() || wc.isCurrentlyAudible()) return false
    if (!manual) { try { if (isLoopbackHost(new URL(url).hostname)) return false } catch { return false } } // dev sunucusu durumunu (React state) otomatik uyutmayla kaybetme
    return true
  }
  sleep(id: string, manual = true): boolean {
    const e = this.tabs.get(id); if (!e || !this.canSleep(e, manual)) return false
    if (e.winId !== this.cur.id) return this.inWin(e.winId, () => this.sleep(id, manual))
    const old = e.view
    e.info.url = old.webContents.getURL(); e.info.title = old.webContents.getTitle() || e.info.title
    if (e.retryTimer) { clearTimeout(e.retryTimer); e.retryTimer = undefined }
    e.interceptor?.detach(); e.cdp?.detach(); e.interceptor = undefined; e.cdp = undefined
    this.bus.dropTab(id)
    e.view = new WebContentsView() // yer tutucu (renderer'i yuklenmemis, gorunmez)
    try { this.win.contentView.removeChildView(old) } catch { /* zaten cocuk degil */ }
    old.webContents.close()
    e.info.sleeping = true; e.info.loading = false; e.info.canGoBack = false; e.info.canGoForward = false
    this.onChange()
    return true
  }
  /** Aktif disindaki uygun tum sekmeleri uyutur; sayisini doner */
  sleepOthers(): number { let n = 0; for (const id of [...this.order]) if (this.sleep(id, true)) n++; return n }
  private sweep(): void {
    const mins = this.hooks.sleepMinutes?.() ?? 0; if (!mins) return
    const cutoff = Date.now() - mins * 60_000
    for (const e of [...this.tabs.values()]) if (e.lastActive < cutoff) this.sleep(e.info.id, false)
  }
  private wake(e: Entry, url?: string): void {
    if (!e.info.sleeping) return
    const target = url ?? e.info.url, id = e.info.id
    delete e.info.sleeping
    const ses = session.fromPartition(partitionFor(e.info.workspaceId))
    const placeholder = e.view
    const view = new WebContentsView({ webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    e.view = view
    try { placeholder.webContents.close() } catch { /* yok */ }
    this.wire(e)
    view.webContents.on('focus', () => this.inWin(e.winId, () => { if (this.split && (id === this.split.a || id === this.split.b) && id !== this.activeId) this.activateIn(id) }))
    void (async () => {
      const wc = view.webContents
      await wc.loadURL('about:blank')
      if (/^https?:/.test(target)) e.lastHttpUrl = target
      e.cdp = await attachCdp(wc, id, this.bus, () => { const u = wc.getURL(); return this.rootFor(/^https?:/.test(u) ? u : e.lastHttpUrl ?? u, e.info.workspaceId) })
      e.interceptor = new Interceptor(wc, id, this.bus, () => this.rulesFor(e.info.workspaceId), this.adHook(wc))
      await e.interceptor.refresh()
      void wc.loadURL(target).catch(() => {})
    })()
    this.onChange()
  }

  /** Sabitlenmis sekmeler her zaman basta (goreli sira korunur) */
  private normalizePins(): void {
    const pin = this.order.filter((i) => this.tabs.get(i)?.info.pinned), rest = this.order.filter((i) => !this.tabs.get(i)?.info.pinned)
    this.order = [...pin, ...rest]
  }
  setPinned(id: string, on: boolean): void {
    const e = this.tabs.get(id); if (!e) return
    if (on) e.info.pinned = true; else delete e.info.pinned
    if (on) { this.order = this.order.filter((i) => i !== id); const n = this.order.filter((i) => this.tabs.get(i)?.info.pinned).length; this.order.splice(n, 0, id) }
    this.normalizePins(); this.onChange(); this.persist()
  }

  /** Sekmeyi cogaltir (ayni URL, ayni Workspace) */
  duplicate(id: string): Promise<string | null> { const e = this.tabs.get(id); return e && e.info.url ? this.create({ url: e.info.url, workspaceId: e.info.workspaceId }) : Promise.resolve(null) }
  /** Ayni Workspace'te `id` disindaki (veya yalnizca sagindaki) sekmeleri kapatir */
  closeOthers(id: string, onlyRight = false): number {
    const e = this.tabs.get(id); if (!e) return 0
    const idx = this.order.indexOf(id)
    const victims = this.order.filter((x, i) => x !== id && this.tabs.get(x)!.info.workspaceId === e.info.workspaceId && (!onlyRight || i > idx))
    victims.forEach((v) => this.close(v))
    return victims.length
  }

  /** Son kapatilan sekmeyi geri acar (en yeni once); Workspace'i silinmisse atlar */
  async reopenClosed(): Promise<string | null> {
    while (this.closed.length) {
      const c = this.closed.pop()!
      if (this.workspaces.get(c.workspaceId)) return this.create({ url: c.url, workspaceId: c.workspaceId })
    }
    return null
  }

  private tidy(url: string): string { const st = this.hooks.stripTracking?.(); return st?.on ? cleanTrackingParams(url, st.dev) : url }
  go(id: string, input: string): void { const url = this.tidy(resolveInput(input, this.hooks.searchEngine?.())); const t = this.tabs.get(id); if (t?.info.sleeping) this.wake(t, url); else if (t) t.failedUrl = undefined; void this.tabs.get(id)?.view.webContents.loadURL(url).catch(() => {}) }
  back(id: string): void { this.tabs.get(id)?.view.webContents.navigationHistory.goBack() }
  forward(id: string): void { this.tabs.get(id)?.view.webContents.navigationHistory.goForward() }
  reload(id: string): void { const t = this.tabs.get(id); if (t?.info.sleeping) { this.wake(t); return } t?.view.webContents.reload() }

  // ---- oturum kaydi: cokme veya yeniden baslatma sonrasi sekmeler geri gelir ----
  private persist(): void {
    try {
      const primary = [...this.ctxs.keys()][0]
      const keep = this.order.filter((i) => { const t = this.tabs.get(i)!.info; return t.url && !t.private })
      const tabs = keep.map((i) => { const t = this.tabs.get(i)!.info; return { url: t.url, workspaceId: t.workspaceId, ...(t.pinned ? { pinned: true } : {}), ...(t.winId !== primary ? { second: true } : {}) } })
      const actives = [...this.ctxs.values()].map((c) => keep.indexOf(c.activeId ?? ''))
      saveDoc(app.getPath('userData'), 'session', { tabs, active: Math.max(0, actives[0] ?? 0), activeSecond: actives[1] ?? -1 })
    } catch { /* disk hatasi oturumu durdurmaz */ }
  }

  async restore(): Promise<boolean> {
    let saved: { tabs: { url: string; workspaceId: string; pinned?: boolean; second?: boolean }[]; active: number; activeSecond?: number }
    const doc = loadDoc<typeof saved>(app.getPath('userData'), 'session'); if (!doc) return false
    saved = doc
    const valid = saved.tabs.filter((t) => this.workspaces.get(t.workspaceId))
    if (!valid.length) return false
    const ids: string[] = []
    // ikinci pencerede sekme varsa o pencere yeniden acilir
    const w2 = valid.some((t) => t.second) ? await this.hooks.openWindow?.() : undefined
    for (const { second, ...t } of valid) ids.push(await this.create({ ...t, ...(second && w2 !== undefined ? { winId: w2 } : {}), activate: false }))
    this.activate(ids[Math.min(saved.active, ids.length - 1)])
    if (w2 !== undefined && saved.activeSecond !== undefined && saved.activeSecond >= 0 && ids[saved.activeSecond]) this.activate(ids[saved.activeSecond])
    return true
  }
}
