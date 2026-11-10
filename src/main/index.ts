import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { Ch, schemas } from '../shared/ipc'
import type { Editor } from '../shared/events'
import { EventBus } from './bus'
import { TabManager } from './tabs'
import { RuleStore } from './rules'
import { Library } from './library'
import { Downloads } from './downloads'
import { parseLaunch, type Launch } from './launch'
import { registerAppScheme, serveApp, lockPermissions, lockShell } from './security'
import { SettingsStore } from './settings'
import { Telemetry, TELEMETRY_EVENTS, type TelemetryEvent } from './telemetry'
import { DemoServer } from './demo'
import { restoreWindowState, trackWindowState } from './window-state'
import { exportReport } from './report'
import { installMenu } from './menu'
import { WorkspaceStore, detectServers, type DetectedServer } from './workspace'

// Test/izolasyon: calisma verisini ayri bir dizine yonlendir (gercek kullanici verisine dokunmaz)
if (process.env.DB_USER_DATA) { app.setPath('userData', process.env.DB_USER_DATA); app.setPath('downloads', join(process.env.DB_USER_DATA, 'downloads')) }

registerAppScheme()
const bus = new EventBus()
let win: BrowserWindow
let tabs: TabManager
let workspaces: WorkspaceStore
let rules: RuleStore
let library: Library
let settings: SettingsStore
let telemetry: Telemetry
let demo: DemoServer
let downloads: Downloads
let activeWorkspaceId = 'default'
let detected: DetectedServer[] = []

function editorUrl(editor: Editor, file: string, line: number, col: number): string {
  if (editor === 'webstorm') return `webstorm://open?file=${encodeURIComponent(file)}&line=${line}&column=${col}`
  return `${editor}://file${encodeURI(file)}:${line}:${col}`
}

const send = (channel: string, payload: unknown): void => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload) }
const pushTabs = (): void => send(Ch.tabsState, { ...tabs.list(), dock: tabs.dock })
const pushSettings = (): void => send(Ch.settingsState, settings.get())
const pushRules = (): void => send(Ch.rulesState, rules.all())
const pushLibrary = (): void => send(Ch.libState, { bookmarks: Object.fromEntries(workspaces.list().map((w) => [w.id, library.bookmarks(w.id)])), downloads: downloads.list() })
const pushWorkspaces = (): void => send(Ch.wsState, { workspaces: workspaces.list(), activeId: activeWorkspaceId, detected })

/** IPC izin listesi: her kanal zod semasiyla dogrulanir; gecersiz mesaj reddedilir. */
function handle<S extends z.ZodType>(channel: string, schema: S | null, fn: (arg: z.infer<S>) => unknown): void {
  ipcMain.handle(channel, (e, raw) => {
    // yalnizca shell penceresi cagirabilir (DevTools veya baska webContents degil)
    if (e.sender !== win?.webContents) throw new Error(`yetkisiz IPC gondereni: ${channel}`)
    if (!schema) return fn(undefined as z.infer<S>)
    const r = schema.safeParse(raw)
    if (!r.success) throw new Error(`gecersiz IPC mesaji: ${channel}`)
    return fn(r.data)
  })
}

/** CLI / izlix:// istekleri: klasor -> Workspace (+ calisan dev sunucusu), url -> yeni sekme */
async function handleLaunch(l: Launch): Promise<void> {
  if (!win) { pendingLaunch = l; return }
  if (win.isMinimized()) win.restore()
  win.focus()
  if (l.type === 'url') { await newTab(l.url); return }
  const w = workspaces.create('', l.dir)
  activeWorkspaceId = w.id
  if (!detected.length) await pollServers() // soguk baslangicta sunucu listesi henuz bos olabilir
  const srv = detected.find((s) => s.cwd && workspaces.workspaceForCwd(s.cwd)?.id === w.id)
  await newTab(srv ? `localhost:${srv.port}` : undefined)
  pushWorkspaces(); pushTabs()
}
let pendingLaunch: Launch | null = parseLaunch(process.argv.slice(1))

async function newTab(url?: string): Promise<string> { return tabs.create({ url, workspaceId: activeWorkspaceId }) }

function registerIpc(): void {
  handle(Ch.tabsCreate, schemas.tabsCreate, ({ url }) => newTab(url))
  handle(Ch.tabsClose, schemas.tabId, ({ id }) => tabs.close(id))
  handle(Ch.tabsActivate, schemas.tabId, ({ id }) => tabs.activate(id))
  handle(Ch.navGo, schemas.navGo, ({ id, input }) => tabs.go(id, input))
  handle(Ch.navBack, schemas.tabId, ({ id }) => tabs.back(id))
  handle(Ch.navForward, schemas.tabId, ({ id }) => tabs.forward(id))
  handle(Ch.navReload, schemas.tabId, ({ id }) => tabs.reload(id))
  handle(Ch.layoutSet, schemas.layoutSet, (p) => { tabs.setLayout(p); pushTabs() })
  handle(Ch.snapshot, schemas.tabId, ({ id }) => bus.snapshot(id))
  handle(Ch.wsSwitch, schemas.wsSwitch, async ({ id }) => {
    if (!workspaces.get(id)) return
    activeWorkspaceId = id
    const mine = tabs.list().tabs.filter((t) => t.workspaceId === id)
    if (mine.length) tabs.activate(mine[0].id); else await newTab()
    pushWorkspaces(); pushTabs(); pushRules()
  })
  // Klasor secerek Workspace kur (kabul kriteri: klasor secilerek Workspace kuruluyor)
  handle(Ch.wsCreate, schemas.wsCreate, async ({ name, rootDir }) => {
    let dir = rootDir
    if (!dir) {
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: 'Workspace klasörünü seç' })
      if (r.canceled || !r.filePaths[0]) return null
      dir = r.filePaths[0]
    }
    const w = workspaces.create(name, dir)
    activeWorkspaceId = w.id
    await newTab(detected.find((s) => s.cwd && workspaces.workspaceForCwd(s.cwd)?.id === w.id) ? `localhost:${detected.find((s) => s.cwd && workspaces.workspaceForCwd(s.cwd)?.id === w.id)!.port}` : undefined)
    pushWorkspaces(); pushTabs()
    return w.id
  })
  // Request Rules: kurallar Workspace'e bagli; degisince tum sekmelerde Fetch alani yeniden degerlendirilir
  handle(Ch.rulesSet, schemas.rulesSet, ({ wsId, rules: list, domains }) => {
    if (!workspaces.get(wsId)) return
    rules.set(wsId, { rules: list, domains: domains.map((d) => d.trim()).filter(Boolean) })
    tabs.refreshRules(); pushRules()
  })
  // React Inspector: agac ve ayrinti sayfadan CDP Runtime.evaluate ile talep uzerine alinir
  const evalInPage = async (tabId: string, expression: string): Promise<any> => {
    const e = tabs.get(tabId); if (!e) return null
    const r = await e.view.webContents.debugger.sendCommand('Runtime.evaluate', { expression, returnByValue: true, timeout: 2000 })
    return r.result?.value ?? null
  }
  handle(Ch.inspTree, schemas.tabId, ({ id }) => evalInPage(id, 'window.__IZLIX_TREE__ ? window.__IZLIX_TREE__() : null'))
  handle(Ch.inspNode, schemas.inspNode, async ({ id, node, t, name }) => {
    const d = await evalInPage(id, `window.__IZLIX_INSPECT__ ? window.__IZLIX_INSPECT__(${node}) : null`)
    const resolver = tabs.get(id)?.cdp?.resolver
    if (d && resolver) {
      if (d.src && t !== undefined) d.source = resolver.setPrecise(t, name, d.src) // hassas mod
      else if (t !== undefined) d.source = await resolver.resolveType(t, name).catch(() => null) ?? null
    }
    return d
  })
  handle(Ch.reportExport, null, () => exportReport(win, tabs, bus, (id) => workspaces.get(id)?.name ?? id))
  handle(Ch.labSet, schemas.labSet, ({ id, devices }) => tabs.setLab(id, devices))
  handle(Ch.libHistory, null, () => library.recent(300))
  handle(Ch.bookmarkToggle, schemas.tabId, ({ id }) => {
    const e = tabs.get(id); if (!e) return false
    const on = library.toggleBookmark(e.info.workspaceId, e.view.webContents.getURL(), e.view.webContents.getTitle())
    pushLibrary(); return on
  })
  handle(Ch.downloadShow, schemas.downloadShow, ({ id }) => downloads.show(id))
  handle(Ch.settingsGet, null, () => settings.get())
  handle(Ch.settingsSet, schemas.settingsSet, (p) => { settings.set(p); pushSettings(); return settings.get() })
  handle(Ch.track, schemas.track, ({ name, props }) => { if ((TELEMETRY_EVENTS as readonly string[]).includes(name)) telemetry.track(name as TelemetryEvent, props) })
  handle(Ch.demoOpen, null, async () => {
    const port = await demo.start()
    telemetry.track('demo.open')
    return newTab(`http://127.0.0.1:${port}/`)
  })
  handle(Ch.overlay, schemas.overlay, ({ open }) => tabs.setOverlay(open))
  // Click-to-source: yalnizca source map'ten cozumlenmis dosyalar acilir
  handle(Ch.sourceOpen, schemas.sourceOpen, async ({ file, line, column, editor }) => {
    const known = tabs.list().tabs.some((t) => tabs.get(t.id)?.cdp?.resolver.knownFiles.has(file))
    if (!known) return false
    await shell.openExternal(editorUrl(editor ?? 'vscode', file, line, column ?? 1))
    return true
  })
}

async function pollServers(): Promise<void> {
  try {
    const next = await detectServers()
    if (next === null) return // lsof zaman asimi: son bilinen durumu koru
    const sig = (l: DetectedServer[]): string => l.map((s) => s.port + s.pid).join()
    if (sig(next) === sig(detected)) return
    detected = next
    const byWs = new Map<string, { port: number; framework?: string }[]>()
    for (const s of next) {
      const w = s.cwd ? workspaces.workspaceForCwd(s.cwd) : undefined
      if (w) byWs.set(w.id, [...(byWs.get(w.id) ?? []), { port: s.port, framework: s.framework }])
    }
    workspaces.servers = byWs
    pushWorkspaces()
  } catch { /* lsof yoksa dedektor sessizce kapali */ }
}

async function createWindow(): Promise<void> {
  const { maximized, ...ws0 } = restoreWindowState({ width: 1500, height: 900 })
  win = new BrowserWindow({
    ...ws0, minWidth: 900, minHeight: 600, titleBarStyle: 'hiddenInset', backgroundColor: '#1c1c1e',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  if (maximized) win.maximize()
  trackWindowState(win)
  workspaces = new WorkspaceStore()
  rules = new RuleStore()
  library = new Library()
  settings = new SettingsStore()
  if (process.env.DB_SCRIPT && !process.env.DB_ONBOARD) settings.set({ onboarded: true }) // testlerde karsilama ekrani sayfa gorunumlerini gizlemesin
  telemetry = new Telemetry(app.getPath('userData'), () => settings.get().telemetry, () => settings.get().installId)
  const samples = join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'samples')
  demo = new DemoServer(join(samples, 'demo'))
  downloads = new Downloads(() => pushLibrary())
  tabs = new TabManager(win, bus, workspaces, pushTabs, (url, wsId) => {
    // 1) sayfanin portunu dinleyen dev sunucusunun cwd'si  2) Workspace kok klasoru
    try { const port = Number(new URL(url).port); if (demo.port && port === demo.port) return join(samples, 'demo-src'); const s = detected.find((d) => d.port === port); if (s?.cwd) return s.cwd } catch { /* gecersiz url */ }
    return workspaces.get(wsId)?.rootDir ?? null
  }, (wsId) => rules.get(wsId), { onVisit: (u, t) => library.addVisit(u, t), onSession: (ses) => { downloads.attach(ses); lockPermissions(ses) } })
  installMenu((cmd) => send(Ch.cmd, cmd))
  registerIpc()
  bus.subscribe((ev, change) => send(change === 'new' ? Ch.evNew : Ch.evUpdate, ev))

  lockShell(win, [process.env.ELECTRON_RENDERER_URL ?? 'app://shell/'])
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else { serveApp(join(__dirname, '../renderer')); await win.loadURL('app://shell/index.html') }

  const restored = process.env.DB_SCRIPT ? false : await tabs.restore()
  if (!restored) await newTab(process.env.DB_URL)
  void pollServers(); setInterval(pollServers, 1500)
  pushWorkspaces(); pushTabs(); pushRules(); pushLibrary(); pushSettings()
  telemetry.track('app.start')

  // Otomatik test modu: DB_SCRIPT = ({ctx}) => Promise<any>; sonuc ve olaylar DB_DUMP'a yazilir
  if (process.env.DB_SCRIPT) {
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
    const ctx = {
      app, win, tabs, bus, library, downloads, handleLaunch, settings, telemetry, demo, exportReport: (p: string) => exportReport(win, tabs, bus, (id) => workspaces.get(id)?.name ?? id, p), workspaces, rules, sleep, refreshRules: () => { tabs.refreshRules(); pushRules() }, detected: () => detected, pushTabs, detectServers,
      newTab,
      shellEval: (code: string): Promise<any> => win.webContents.executeJavaScript(code),
      shot: async (file: string): Promise<void> => { writeFileSync(file, (await win.webContents.capturePage()).toPNG()) },
      pageEval: (code: string): Promise<any> => tabs.active()!.view.webContents.executeJavaScript(code),
      click: async (selector: string): Promise<void> => {
        const wc = tabs.active()!.view.webContents
        const [x, y] = await wc.executeJavaScript(`(()=>{const r=document.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();return [Math.round(r.x+r.width/2),Math.round(r.y+r.height/2)]})()`)
        wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 })
        wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
      }
    }
    let result: unknown
    try { result = await require(process.env.DB_SCRIPT)(ctx) } catch (e) { result = { scriptError: String(e) } }
    const tabId = tabs.list().activeId
    writeFileSync(process.env.DB_DUMP ?? '/private/tmp/e2e-tmp/db-result.json', JSON.stringify({ result, events: tabId ? bus.snapshot(tabId) : [] }, null, 1))
    app.quit()
  }
}

const gotLock = process.env.DB_SCRIPT ? true : app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', (_e, argv, cwd) => { const l = parseLaunch(argv, cwd); if (l) void handleLaunch(l) })
app.on('open-url', (e, url) => { e.preventDefault(); const l = parseLaunch([url]); if (l) void handleLaunch(l) })
if (!process.env.DB_SCRIPT) app.setAsDefaultProtocolClient('izlix')
if (gotLock) app.whenReady().then(async () => { await createWindow(); if (pendingLaunch) { const l = pendingLaunch; pendingLaunch = null; await handleLaunch(l) } })
app.on('before-quit', () => library?.flush())
app.on('window-all-closed', () => app.quit())
