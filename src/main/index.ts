import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron'
import { join } from 'node:path'
import { writeFileSync } from 'node:fs'
import { z } from 'zod'
import { Ch, schemas } from '../shared/ipc'
import type { Editor } from '../shared/events'
import { EventBus } from './bus'
import { TabManager } from './tabs'
import { WorkspaceStore, detectServers, type DetectedServer } from './workspace'

// Test/izolasyon: calisma verisini ayri bir dizine yonlendir (gercek kullanici verisine dokunmaz)
if (process.env.DB_USER_DATA) app.setPath('userData', process.env.DB_USER_DATA)

const bus = new EventBus()
let win: BrowserWindow
let tabs: TabManager
let workspaces: WorkspaceStore
let activeWorkspaceId = 'default'
let detected: DetectedServer[] = []

function editorUrl(editor: Editor, file: string, line: number, col: number): string {
  if (editor === 'webstorm') return `webstorm://open?file=${encodeURIComponent(file)}&line=${line}&column=${col}`
  return `${editor}://file${encodeURI(file)}:${line}:${col}`
}

const send = (channel: string, payload: unknown): void => { if (win && !win.isDestroyed()) win.webContents.send(channel, payload) }
const pushTabs = (): void => send(Ch.tabsState, { ...tabs.list(), dock: tabs.dock })
const pushWorkspaces = (): void => send(Ch.wsState, { workspaces: workspaces.list(), activeId: activeWorkspaceId, detected })

/** IPC izin listesi: her kanal zod semasiyla dogrulanir; gecersiz mesaj reddedilir. */
function handle<S extends z.ZodType>(channel: string, schema: S | null, fn: (arg: z.infer<S>) => unknown): void {
  ipcMain.handle(channel, (_e, raw) => {
    if (!schema) return fn(undefined as z.infer<S>)
    const r = schema.safeParse(raw)
    if (!r.success) throw new Error(`gecersiz IPC mesaji: ${channel}`)
    return fn(r.data)
  })
}

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
    pushWorkspaces(); pushTabs()
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
  win = new BrowserWindow({
    width: 1500, height: 900, minWidth: 900, minHeight: 600, titleBarStyle: 'hiddenInset', backgroundColor: '#1c1c1e',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  workspaces = new WorkspaceStore()
  tabs = new TabManager(win, bus, workspaces, pushTabs, (url, wsId) => {
    // 1) sayfanin portunu dinleyen dev sunucusunun cwd'si  2) Workspace kok klasoru
    try { const port = Number(new URL(url).port); const s = detected.find((d) => d.port === port); if (s?.cwd) return s.cwd } catch { /* gecersiz url */ }
    return workspaces.get(wsId)?.rootDir ?? null
  })
  registerIpc()
  bus.subscribe((ev, change) => send(change === 'new' ? Ch.evNew : Ch.evUpdate, ev))

  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else await win.loadFile(join(__dirname, '../renderer/index.html'))

  const restored = process.env.DB_SCRIPT ? false : await tabs.restore()
  if (!restored) await newTab(process.env.DB_URL)
  void pollServers(); setInterval(pollServers, 1500)
  pushWorkspaces(); pushTabs()

  // Otomatik test modu: DB_SCRIPT = ({ctx}) => Promise<any>; sonuc ve olaylar DB_DUMP'a yazilir
  if (process.env.DB_SCRIPT) {
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
    const ctx = {
      app, win, tabs, bus, workspaces, sleep, detected: () => detected, pushTabs, detectServers,
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

app.whenReady().then(createWindow)
app.on('window-all-closed', () => app.quit())
