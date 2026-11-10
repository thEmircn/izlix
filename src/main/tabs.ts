import { BrowserWindow, WebContentsView, session, app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import type { TabInfo, DevToolsDock } from '../shared/events'
import { computeLayout, type LayoutParams } from '../shared/layout'
import { isAllowedPageNavigation, resolveInput } from '../shared/url'
import { attachCdp, type Tab } from './cdp'
import type { EventBus } from './bus'
import { partitionFor, type WorkspaceStore } from './workspace'
import { Interceptor } from './interceptor'
import { Lab } from './lab'
import { errorPageHtml, shouldRetry } from './errorpage'
import { isLoopbackHost } from './security'
import { deviceById, type Device } from '../shared/lab'
import type { RulesConfig } from '../shared/rules'
import { emulationCommands, geoPreset, type Emu } from '../shared/emulation'

interface Entry {
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
  private activeId: string | null = null
  private seq = 0
  private closed: { url: string; workspaceId: string }[] = []
  private layoutParams: LayoutParams = { dock: 'off', panelRatio: 0.4, chromeHeight: 84 }
  private sessionFile = join(app.getPath('userData'), 'session.json')

  constructor(private win: BrowserWindow, private bus: EventBus, private workspaces: WorkspaceStore, private onChange: () => void,
    /** sayfanin dev sunucusunun proje kokunu bulur (Workspace kokunun yoksa port -> cwd) */
    private rootFor: (url: string, workspaceId: string) => string | null = () => null,
    /** Workspace'in Request Rules yapilandirmasi */
    private rulesFor: (workspaceId: string) => RulesConfig = () => ({ rules: [], domains: [] }),
    private hooks: { detectedPorts?: () => number[]; language?: () => 'en' | 'tr'; onFound?: (tabId: string, active: number, total: number) => void; onVisit?: (url: string, title: string) => void; onSession?: (ses: Electron.Session) => void } = {}) {
    win.on('resize', () => this.layout())
  }

  list(): { tabs: TabInfo[]; activeId: string | null } {
    return { tabs: this.order.map((id) => this.tabs.get(id)!.info), activeId: this.activeId }
  }
  get(id: string): Entry | undefined { return this.tabs.get(id) }
  active(): Entry | undefined { return this.activeId ? this.tabs.get(this.activeId) : undefined }

  async create(opts: { url?: string; workspaceId: string; activate?: boolean }): Promise<string> {
    const id = `tab-${++this.seq}`
    const ses = session.fromPartition(partitionFor(opts.workspaceId))
    this.hooks.onSession?.(ses)
    // Sayfa gorunumu: preload yok, sandbox, contextIsolation (plan bolum 4: sayfa hicbir IPC kanalina erisemez)
    const view = new WebContentsView({ webPreferences: { session: ses, sandbox: true, contextIsolation: true, nodeIntegration: false } })
    const entry: Entry = { view, info: { id, workspaceId: opts.workspaceId, title: 'New Tab', url: '', loading: false, canGoBack: false, canGoForward: false } }
    this.tabs.set(id, entry); this.order.push(id)
    this.wire(entry)
    if (opts.activate !== false) this.activate(id)

    const wc = view.webContents
    // CDP: ilk sayfa yuklenmeden komutlar yanit vermez -> about:blank, kurulum, asil sayfa
    await wc.loadURL('about:blank')
    const target = resolveInput(opts.url ?? '')
    if (/^https?:/.test(target)) entry.lastHttpUrl = target
    entry.cdp = await attachCdp(wc, id, this.bus, () => {
      const u = wc.getURL()
      return this.rootFor(/^https?:/.test(u) ? u : entry.lastHttpUrl ?? u, opts.workspaceId)
    })
    entry.interceptor = new Interceptor(wc, id, this.bus, () => this.rulesFor(opts.workspaceId))
    await entry.interceptor.refresh()
    if (target !== 'about:blank') void wc.loadURL(target).catch(() => {})
    this.persist()
    return id
  }

  private wire(e: Entry): void {
    const wc = e.view.webContents
    const sync = (): void => {
      if (/^https?:/.test(wc.getURL())) e.lastHttpUrl = wc.getURL()
      Object.assign(e.info, {
        title: wc.getURL() === 'about:blank' ? 'New Tab' : wc.getTitle() || e.info.title, url: wc.getURL() === 'about:blank' ? '' : wc.getURL(), loading: wc.isLoading(),
        canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward()
      })
      this.onChange()
    }
    wc.on('did-start-navigation', (d: any) => {
      if (!d.isMainFrame || d.isSameDocument) return
      e.interceptor?.setPageUrl(d.url); void e.interceptor?.refresh()
    })
    wc.on('did-navigate', () => { e.interceptor?.setPageUrl(null); void e.interceptor?.refresh() })
    for (const ev of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated'] as const) wc.on(ev as any, sync)
    wc.on('did-stop-loading', () => { this.persist(); this.hooks.onVisit?.(wc.getURL(), wc.getTitle()) })
    wc.on('page-title-updated', () => this.hooks.onVisit?.(wc.getURL(), wc.getTitle()))
    // Cokme sonrasi kurtarma: render sureci olurse sekme yeniden yuklenir
    wc.on('render-process-gone', (_ev, d) => { if (d.reason !== 'clean-exit') setTimeout(() => { if (!wc.isDestroyed()) wc.reload() }, 300) })
    // target=_blank ve window.open: yeni sekmede ac (ayni Workspace)
    wc.setWindowOpenHandler(({ url }) => { if (isAllowedPageNavigation(url)) void this.create({ url, workspaceId: e.info.workspaceId }); return { action: 'deny' } })
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
    wc.on('will-navigate', guard)
    wc.on('will-redirect', guard)
  }

  activate(id: string): void {
    if (!this.tabs.has(id)) return
    if (id === this.activeId) return // zaten aktif: DevTools'u yok edip yeniden kurma
    const prev = this.active()
    if (prev) { this.win.contentView.removeChildView(prev.view); prev.lab?.removeViews(); this.releaseDevTools(prev) }
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
    if (cur.lab) cur.lab.layout(l.page); else cur.view.setBounds(l.page)
    if (cur.devtools && l.devtools) cur.devtools.setBounds(l.devtools)
  }

  close(id: string): void {
    const e = this.tabs.get(id)
    if (!e) return
    const idx = this.order.indexOf(id)
    if (e.info.url) { this.closed.push({ url: e.info.url, workspaceId: e.info.workspaceId }); if (this.closed.length > 20) this.closed.shift() }
    this.win.contentView.removeChildView(e.view)
    if (e.retryTimer) clearTimeout(e.retryTimer)
    this.releaseDevTools(e)
    void e.lab?.dispose(); e.interceptor?.detach()
    e.cdp?.detach()
    this.bus.dropTab(id)
    e.view.webContents.close()
    this.tabs.delete(id); this.order.splice(idx, 1)
    if (this.activeId === id) {
      this.activeId = null
      const next = this.order[Math.min(idx, this.order.length - 1)]
      if (next) this.activate(next)
    }
    this.onChange(); this.persist()
  }

  async setCacheDisabled(id: string, disabled: boolean): Promise<void> {
    const e = this.tabs.get(id)
    if (!e || e.view.webContents.isDestroyed()) return
    for (const wc of [e.view.webContents, ...(e.lab?.webContents ?? [])]) await wc.debugger.sendCommand('Network.setCacheDisabled', { cacheDisabled: disabled }).catch(() => {})
    e.info.noCache = disabled || undefined
    this.onChange()
  }

  /** Ag/CPU kisitlama ve konum emulasyonu: verilen alanlar guncellenir (null = o ayari sifirla). Lab aciksa tum viewport'lara uygulanir. */
  async setEmulation(id: string, patch: { network?: string | null; cpu?: number | null; geo?: string | null }): Promise<void> {
    const e = this.tabs.get(id)
    if (!e || e.view.webContents.isDestroyed()) return
    const next: Emu = { ...(e.info.emu ?? {}) }
    if ('network' in patch) { if (patch.network) next.network = patch.network; else delete next.network }
    if ('cpu' in patch) { if (patch.cpu && patch.cpu > 1) next.cpu = patch.cpu; else delete next.cpu }
    if ('geo' in patch) { if (patch.geo) next.geo = patch.geo; else delete next.geo }
    const targets = [e.view.webContents, ...(e.lab?.webContents ?? [])].filter((w, i, a) => a.indexOf(w) === i)
    for (const wc of targets) for (const [m, p] of emulationCommands(next)) await wc.debugger.sendCommand(m, p).catch(() => {})
    e.info.emu = Object.keys(next).length ? next : undefined
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
    const features: { name: string; value: string }[] = []
    if (colorScheme) features.push({ name: 'prefers-color-scheme', value: colorScheme })
    if (reducedMotion) features.push({ name: 'prefers-reduced-motion', value: 'reduce' })
    await e.view.webContents.debugger.sendCommand('Emulation.setEmulatedMedia', { features }).catch(() => {})
    if (e.lab) { e.lab.media = features; await e.lab.applyMedia(features) }
    e.info.media = colorScheme || reducedMotion ? { colorScheme: colorScheme ?? undefined, reducedMotion: reducedMotion || undefined } : undefined
    this.onChange()
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
        e.lab = new Lab(this.win, e.view, session.fromPartition(partitionFor(e.info.workspaceId)))
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
    const cur = this.active()
    cur?.view.setVisible(!open); cur?.devtools?.setVisible(!open); cur?.lab?.setVisible(!open)
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

  go(id: string, input: string): void { const t = this.tabs.get(id); if (t) t.failedUrl = undefined; void this.tabs.get(id)?.view.webContents.loadURL(resolveInput(input)).catch(() => {}) }
  back(id: string): void { this.tabs.get(id)?.view.webContents.navigationHistory.goBack() }
  forward(id: string): void { this.tabs.get(id)?.view.webContents.navigationHistory.goForward() }
  reload(id: string): void { this.tabs.get(id)?.view.webContents.reload() }

  // ---- oturum kaydi: cokme veya yeniden baslatma sonrasi sekmeler geri gelir ----
  private persist(): void {
    try {
      const tabs = this.order.map((id) => this.tabs.get(id)!.info).filter((t) => t.url).map((t) => ({ url: t.url, workspaceId: t.workspaceId }))
      writeFileSync(this.sessionFile, JSON.stringify({ tabs, active: Math.max(0, this.order.findIndex((i) => i === this.activeId)) }))
    } catch { /* disk hatasi oturumu durdurmaz */ }
  }

  async restore(): Promise<boolean> {
    let saved: { tabs: { url: string; workspaceId: string }[]; active: number }
    try { saved = JSON.parse(readFileSync(this.sessionFile, 'utf8')) } catch { return false }
    const valid = saved.tabs.filter((t) => this.workspaces.get(t.workspaceId))
    if (!valid.length) return false
    const ids: string[] = []
    for (const t of valid) ids.push(await this.create({ ...t, activate: false }))
    this.activate(ids[Math.min(saved.active, ids.length - 1)])
    return true
  }
}
