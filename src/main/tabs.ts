import { BrowserWindow, WebContentsView, session, app } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'
import type { TabInfo, DevToolsDock } from '../shared/events'
import { computeLayout, type LayoutParams } from '../shared/layout'
import { resolveInput } from '../shared/url'
import { attachCdp, type Tab } from './cdp'
import type { EventBus } from './bus'
import { partitionFor, type WorkspaceStore } from './workspace'

interface Entry {
  info: TabInfo
  view: WebContentsView
  cdp?: Tab
  devtools?: WebContentsView
  /** son bilinen http(s) adresi: sayfa commit olmadan (about:blank) gelen cozumlemeler icin yedek */
  lastHttpUrl?: string
}

/** Sekme yoneticisi: her sekme ayri WebContentsView; oturum Workspace basina ayri bolum (cerez/depolama izolasyonu). */
export class TabManager {
  private tabs = new Map<string, Entry>()
  private order: string[] = []
  private activeId: string | null = null
  private seq = 0
  private layoutParams: LayoutParams = { dock: 'right', panelRatio: 0.4, chromeHeight: 84 }
  private sessionFile = join(app.getPath('userData'), 'session.json')

  constructor(private win: BrowserWindow, private bus: EventBus, private workspaces: WorkspaceStore, private onChange: () => void,
    /** sayfanin dev sunucusunun proje kokunu bulur (Workspace kokunun yoksa port -> cwd) */
    private rootFor: (url: string, workspaceId: string) => string | null = () => null) {
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
    for (const ev of ['did-start-loading', 'did-stop-loading', 'did-navigate', 'did-navigate-in-page', 'page-title-updated'] as const) wc.on(ev as any, sync)
    wc.on('did-stop-loading', () => this.persist())
    // Cokme sonrasi kurtarma: render sureci olurse sekme yeniden yuklenir
    wc.on('render-process-gone', (_ev, d) => { if (d.reason !== 'clean-exit') setTimeout(() => { if (!wc.isDestroyed()) wc.reload() }, 300) })
    // target=_blank ve window.open: yeni sekmede ac (ayni Workspace)
    wc.setWindowOpenHandler(({ url }) => { void this.create({ url, workspaceId: e.info.workspaceId }); return { action: 'deny' } })
  }

  activate(id: string): void {
    if (!this.tabs.has(id)) return
    const prev = this.active()
    if (prev) { this.win.contentView.removeChildView(prev.view); if (prev.devtools) this.win.contentView.removeChildView(prev.devtools) }
    this.activeId = id
    const cur = this.tabs.get(id)!
    this.win.contentView.addChildView(cur.view)
    this.ensureDevTools(cur)
    this.layout(); this.onChange(); this.persist()
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
      if (p.dock === 'off' && cur.devtools) this.win.contentView.removeChildView(cur.devtools)
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
    cur.view.setBounds(l.page)
    if (cur.devtools && l.devtools) cur.devtools.setBounds(l.devtools)
  }

  close(id: string): void {
    const e = this.tabs.get(id)
    if (!e) return
    const idx = this.order.indexOf(id)
    this.win.contentView.removeChildView(e.view)
    if (e.devtools) this.win.contentView.removeChildView(e.devtools)
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

  go(id: string, input: string): void { void this.tabs.get(id)?.view.webContents.loadURL(resolveInput(input)).catch(() => {}) }
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
