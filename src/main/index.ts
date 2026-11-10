import { app, BrowserWindow, clipboard, dialog, ipcMain, Menu, session, shell } from 'electron'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import { z } from 'zod'
import { Ch, schemas } from '../shared/ipc'
import type { Editor } from '../shared/events'
import { EventBus } from './bus'
import { TabManager } from './tabs'
import { RuleStore } from './rules'
import { PermissionStore, originOf, permissionKey } from './permissions'
import { Library } from './library'
import { Downloads, uniquePath } from './downloads'
import { parseLaunch, type Launch } from './launch'
import { registerAppScheme, serveApp, lockPermissions, lockShell, isInsideAny, trustLoopbackCerts } from './security'
import { SettingsStore } from './settings'
import { SessionStore } from './sessions'
import { translate, type Key } from '../shared/i18n'
import { Telemetry, TELEMETRY_EVENTS, type TelemetryEvent } from './telemetry'
import { DemoServer } from './demo'
import { restoreWindowState, trackWindowState } from './window-state'
import { loadSnapshot, saveSnapshot } from './snapshot'
import { buildHar } from './report-data'
import { maskDeep } from '../shared/mask'
import { CdpProxy } from './cdpproxy'
import { DevServers } from './devserver'
import { DebuggerService } from './debugger'
import { A11Y_AUDIT } from './a11y-audit'
import { CSS_SNAPSHOT } from './css-snapshot'
import { SEO_SCRIPT } from './seo-script'
import { IMAGE_AUDIT, LINK_CHECK } from './page-tools'
import { loadBundle } from './source-bundle'
import { captureShot, shotName } from './shots'
import { formatEval } from './evalformat'
import { exportReport } from './report'
import { installMenu } from './menu'
import { WorkspaceStore, detectServers, partitionFor, type DetectedServer } from './workspace'

// Test/izolasyon: calisma verisini ayri bir dizine yonlendir (gercek kullanici verisine dokunmaz)
if (process.env.DB_USER_DATA) { app.setPath('userData', process.env.DB_USER_DATA); app.setPath('downloads', join(process.env.DB_USER_DATA, 'downloads')) }

registerAppScheme()
const bus = new EventBus()
let win: BrowserWindow
let tabs: TabManager
let workspaces: WorkspaceStore
let rules: RuleStore
let library: Library
let sessions: SessionStore
let settings: SettingsStore
const tr = (k: Key, v?: Record<string, string | number>): string => translate(settings?.get().language ?? 'tr', k, v)
let perms: PermissionStore
const pendingPerms = new Map<string, (a: 'allow-once' | 'allow' | 'block') => void>()
let permSeq = 0
let telemetry: Telemetry
let demo: DemoServer
let samplesDir = ''
let proxy: CdpProxy
let servers: DevServers
let dbg: DebuggerService
let polledOnce = false
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
const pushSessions = (): void => send(Ch.sessState, sessions.all())
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
  if (!process.env.DB_SCRIPT || process.env.DB_VISIBLE) win.focus()
  if (l.type === 'url') { await newTab(l.url); return }
  const w = workspaces.create('', l.dir)
  activeWorkspaceId = w.id
  if (!detected.length) await pollServers() // soguk baslangicta sunucu listesi henuz bos olabilir
  const srv = detected.find((s) => s.cwd && workspaces.workspaceForCwd(s.cwd)?.id === w.id)
  // --run: calisan sunucu yoksa package.json'daki en uygun script baslatilir (URL gorununce sekme kendiliginden acilir)
  const sc = l.run && !srv ? DevServers.scan(l.dir).scripts.find((x) => x.likely) : undefined
  if (sc) servers.start(w.id, l.dir, sc.name)
  if (!sc) await newTab(srv ? `localhost:${srv.port}` : undefined)
  pushWorkspaces(); pushTabs()
}
let pendingLaunch: Launch | null = parseLaunch(process.argv.slice(1))

async function newTab(url?: string): Promise<string> { return tabs.create({ url, workspaceId: activeWorkspaceId }) }

function registerIpc(): void {
  handle(Ch.tabsCreate, schemas.tabsCreate, ({ url }) => newTab(url))
  handle(Ch.tabsClose, schemas.tabId, ({ id }) => { proxy.drop(id); dbg.drop(id); tabs.close(id) })
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
      const r = await dialog.showOpenDialog(win, { properties: ['openDirectory'], title: tr('dlg.pickFolder') })
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
  handle(Ch.settingsSet, schemas.settingsSet, (p) => { const before = settings.get().language; settings.set(p); if (p.language && p.language !== before) installMenu((cmd) => send(Ch.cmd, cmd), settings.get().language); pushSettings(); return settings.get() })
  handle(Ch.track, schemas.track, ({ name, props }) => { if ((TELEMETRY_EVENTS as readonly string[]).includes(name)) telemetry.track(name as TelemetryEvent, props) })
  handle(Ch.demoOpen, null, async () => {
    const port = await demo.start()
    telemetry.track('demo.open')
    return newTab(`http://127.0.0.1:${port}/`)
  })
  handle(Ch.mediaSet, schemas.mediaSet, ({ id, colorScheme, reducedMotion }) => tabs.setMedia(id, colorScheme, reducedMotion))
  handle(Ch.snapshotSave, schemas.tabId, ({ id }) => { const f = saveSnapshot(join(app.getPath('userData'), 'snapshots'), bus.snapshot(id)); if (!process.env.DB_SCRIPT) shell.showItemInFolder(f); return f })
  // Mock'u gercek yanit govdesiyle doldurmak icin: yalnizca metin, en fazla 200 KB
  handle(Ch.reqBody, schemas.reqBody, async ({ id, requestId }) => {
    const e = tabs.get(id); if (!e) return null
    try {
      const r: any = await e.view.webContents.debugger.sendCommand('Network.getResponseBody', { requestId })
      if (String(r.body).length > 300_000) return null
      if (!r.base64Encoded) return String(r.body)
      // base64 gelen govde (content-type yok): gecerli UTF-8 ve kontrol karakteri icermiyorsa metin say
      const buf = Buffer.from(r.body, 'base64')
      if (buf.length > 200_000) return null
      const text = buf.toString('utf8')
      return !text.includes('\uFFFD') && !/[\u0000-\u0008\u000E-\u001F]/.test(text) ? text : null
    } catch { return null }
  })
  handle(Ch.wsRename, schemas.wsRename, ({ id, name }) => { const ok = workspaces.rename(id, name); if (ok) pushWorkspaces(); return ok })
  // Workspace sil: onay, sekmeleri kapat, oturum verisini (cerez/depolama) temizle, kurallari sil
  handle(Ch.wsDelete, schemas.tabId, async ({ id }) => {
    const w = workspaces.get(id)
    if (!w || id === 'default') return false
    if (!process.env.DB_SCRIPT) {
      const r = await dialog.showMessageBox(win, { type: 'warning', buttons: [tr('dlg.delete'), tr('dlg.cancel')], defaultId: 1, cancelId: 1, message: tr('dlg.wsDelete', { n: w.name }), detail: tr('dlg.wsDeleteDetail') })
      if (r.response !== 0) return false
    }
    for (const t of tabs.list().tabs.filter((x) => x.workspaceId === id)) tabs.close(t.id)
    await session.fromPartition(partitionFor(id)).clearStorageData().catch(() => {})
    rules.delete(id); workspaces.remove(id)
    if (activeWorkspaceId === id) {
      activeWorkspaceId = 'default'
      const mine = tabs.list().tabs.filter((t) => t.workspaceId === 'default')
      if (mine.length) tabs.activate(mine[0].id); else await newTab()
    }
    pushWorkspaces(); pushTabs(); pushRules(); pushLibrary()
    return true
  })
  handle(Ch.findStart, schemas.findStart, ({ id, text, forward, next }) => { tabs.get(id)?.view.webContents.findInPage(text, { forward, findNext: next }) })
  handle(Ch.findStop, schemas.tabId, ({ id }) => { tabs.get(id)?.view.webContents.stopFindInPage('clearSelection') })
  handle(Ch.tabsReopen, null, () => tabs.reopenClosed())
  // Elements / Storage panelleri: izin listeli CDP koprusu (yalnizca shell cagirabilir)
  handle(Ch.dtCall, schemas.dtCall, ({ id, method, params }) => proxy.call(id, method, params))
  handle(Ch.dtEnable, schemas.dtFeature, ({ id, feature }) => proxy.enable(id, feature))
  handle(Ch.dtDisable, schemas.dtFeature, ({ id, feature }) => proxy.disable(id, feature))
  handle(Ch.dtReact, schemas.dtReact, async ({ id, nodeId }) => {
    const chain = await proxy.reactChain(id, nodeId)
    const comps = [...(tabs.get(id)?.cdp?.resolver.components.values() ?? [])]
    return chain?.map((c) => {
      const m = c.src ? /^(.*):(\d+):(\d+)$/.exec(c.src) : null
      const known = comps.find((x) => x.name === c.name)
      const file = m ? m[1] : known?.file
      const resolver = tabs.get(id)?.cdp?.resolver
      // derleme eklentisinden gelen yol sayfa kontrollu: yalnizca guvenilir kok altindaysa "bilinen" olur
      if (file && resolver && m && isInsideAny([workspaces.get(tabs.get(id)!.info.workspaceId)?.rootDir, resolver.rootProvider?.()], file)) resolver.knownFiles.add(file)
      return { name: c.name, file, line: m ? Number(m[2]) : known?.line }
    }) ?? null
  })
  // Console REPL: kullanicinin yazdigi ifade sayfada calistirilir (yalnizca shell cagirabilir)
  handle(Ch.dtEval, schemas.dtEval, async ({ id, expression }) => {
    const wc = tabs.get(id)?.view.webContents
    if (!wc || wc.isDestroyed()) return { ok: false, text: 'no page' }
    try {
      const r: any = await wc.debugger.sendCommand('Runtime.evaluate', { expression, includeCommandLineAPI: true, replMode: true, awaitPromise: true, generatePreview: true, userGesture: true, timeout: 5000 })
      return formatEval(r)
    } catch (e) { return { ok: false, text: String((e as Error).message ?? e) } }
  })
  handle(Ch.emuSet, schemas.emuSet, ({ id, ...patch }) => tabs.setEmulation(id, patch))
  // Ekran goruntusu: kaydet (~/Downloads) veya panoya kopyala. Dugum modu Elements'ten gelen nodeId ister (DOM etkin olmali).
  handle(Ch.shot, schemas.shot, async ({ id, kind, nodeId, copy }) => {
    const e = tabs.get(id); if (!e) return null
    const png = await captureShot(e.view.webContents, kind, nodeId)
    if (!png) return null
    if (copy) return { b64: png.toString('base64'), bytes: png.length } // panoya shell yazar (navigator.clipboard)
    mkdirSync(app.getPath('downloads'), { recursive: true })
    const file = uniquePath(app.getPath('downloads'), shotName(e.view.webContents.getURL()))
    writeFileSync(file, png)
    if (!process.env.DB_SCRIPT) shell.showItemInFolder(file)
    return { path: file, bytes: png.length }
  })
  handle(Ch.a11y, schemas.tabId, ({ id }) => evalInPage(id, A11Y_AUDIT))
  handle(Ch.flash, schemas.flash, ({ id, on }) => evalInPage(id, `window.__IZLIX_FLASH__ ? window.__IZLIX_FLASH__(${on ? 'true' : 'false'}) : null`))
  handle(Ch.cacheSet, schemas.cacheSet, ({ id, disabled }) => tabs.setCacheDisabled(id, disabled))
  // Sekme sag-tik menusu (yerel macOS menusu)
  handle(Ch.tabMenu, schemas.tabId, ({ id }) => {
    const e = tabs.get(id); if (!e) return
    const url = e.view.webContents.getURL()
    Menu.buildFromTemplate([
      { label: tr('ctx.reload'), click: () => tabs.reload(id) },
      { label: tr('ctx.duplicate'), click: () => void tabs.duplicate(id) },
      ...(tabs.active() && tabs.active()!.info.id !== id ? [{ label: tabs.splitIds.includes(id) ? tr('ctx.unsplit') : tr('ctx.split'), click: () => { if (tabs.splitIds.includes(id)) tabs.setSplit(null); else tabs.setSplit(id) } }] : []),
      { label: tr('ctx.copyUrl'), enabled: !!url, click: () => clipboard.writeText(url) },
      { label: library.isBookmarked(e.info.workspaceId, url) ? tr('ctx.unbookmark') : tr('ctx.bookmark'), enabled: /^https?:/.test(url), click: () => { library.toggleBookmark(e.info.workspaceId, url, e.view.webContents.getTitle()); pushLibrary() } },
      { type: 'separator' },
      { label: tr('ctx.close'), click: () => { proxy.drop(id); tabs.close(id) } },
      { label: tr('ctx.closeOthers'), click: () => { tabs.closeOthers(id) } },
      { label: tr('ctx.closeRight'), click: () => { tabs.closeOthers(id, true) } }
    ]).popup({ window: win })
  })
  handle(Ch.hookSet, schemas.hookSet, ({ id, node, index, json }) => evalInPage(id, `window.__IZLIX_SET_HOOK__ ? window.__IZLIX_SET_HOOK__(${node}, ${index}, ${JSON.stringify(json)}) : null`))
  handle(Ch.propSet, schemas.propSet, ({ id, node, key, json }) => evalInPage(id, `window.__IZLIX_SET_PROP__ ? window.__IZLIX_SET_PROP__(${node}, ${JSON.stringify(key)}, ${JSON.stringify(json)}) : null`))
  handle(Ch.dtReactIdx, schemas.dtReact, ({ id, nodeId }) => proxy.reactIndex(id, nodeId))
  // HAR 1.2 (maskeli): Downloads'a kaydedilir
  handle(Ch.harSave, schemas.tabId, ({ id }) => {
    const e = tabs.get(id); if (!e) return null
    mkdirSync(app.getPath('downloads'), { recursive: true })
    const base = shotName(e.view.webContents.getURL()).replace(/\.png$/, '.har').replace('izlix-', 'izlix-net-')
    const file = uniquePath(app.getPath('downloads'), base)
    writeFileSync(file, JSON.stringify(maskDeep(buildHar(bus.snapshot(id), app.getVersion())), null, 1))
    if (!process.env.DB_SCRIPT) shell.showItemInFolder(file)
    return file
  })
  handle(Ch.permAnswer, schemas.permAnswer, ({ id, answer }) => { const f = pendingPerms.get(id); if (f) { pendingPerms.delete(id); f(answer) } })
  handle(Ch.permList, null, () => perms.list())
  handle(Ch.permRemove, schemas.permRemove, ({ origin, permission }) => perms.remove(origin, permission))
  handle(Ch.cssSnap, schemas.tabId, ({ id }) => evalInPage(id, CSS_SNAPSHOT))
  handle(Ch.seoAudit, schemas.tabId, ({ id }) => evalInPage(id, SEO_SCRIPT))
  handle(Ch.linkCheck, schemas.tabId, async ({ id }) => {
    const e = tabs.get(id); if (!e) return null
    const r: any = await e.view.webContents.debugger.sendCommand('Runtime.evaluate', { expression: LINK_CHECK, awaitPromise: true, returnByValue: true, timeout: 30_000 }).catch(() => null)
    return r?.result?.value ?? null
  })
  handle(Ch.imageAudit, schemas.tabId, ({ id }) => evalInPage(id, IMAGE_AUDIT))
  handle(Ch.tabMove, schemas.tabMove, ({ id, index }) => tabs.move(id, index))
  // Kaydedilmis anlik goruntuyu ac (salt okunur inceleme)
  handle(Ch.snapshotOpen, null, async () => {
    if (process.env.DB_SCRIPT && process.env.DB_SNAPSHOT_FILE) return { name: process.env.DB_SNAPSHOT_FILE.split('/').pop(), events: loadSnapshot(process.env.DB_SNAPSHOT_FILE) } // test kipi: diyalogsuz
    const r = await dialog.showOpenDialog(win, { title: tr('dlg.openSnap'), defaultPath: join(app.getPath('userData'), 'snapshots'), filters: [{ name: tr('dlg.snapName'), extensions: ['gz'] }], properties: ['openFile'] })
    if (r.canceled || !r.filePaths[0]) return null
    try { return { name: r.filePaths[0].split('/').pop(), events: loadSnapshot(r.filePaths[0]) } } catch { return null }
  })
  // Dev sunucusu: Workspace klasorundeki package.json script'i (yalnizca tanimli script'ler) calistirilir
  handle(Ch.srvInfo, schemas.wsId, ({ wsId }) => servers.info(wsId, workspaces.get(wsId)?.rootDir ?? null))
  handle(Ch.srvStart, schemas.srvStart, ({ wsId, script }) => { const w = workspaces.get(wsId); return w?.rootDir ? servers.start(wsId, w.rootDir, script) : false })
  handle(Ch.srvStop, schemas.wsId, ({ wsId }) => servers.stop(wsId))
  handle(Ch.marker, schemas.marker, ({ id, text }) => { if (tabs.get(id)) bus.emit({ tabId: id, kind: 'marker', source: 'user:marker', payload: { text } }) })
  // Sources: betik + source map (yalnizca http/https; sayfanin oturumuyla getirilir)
  handle(Ch.srcLoad, schemas.srcLoad, async ({ id, url }) => {
    const e = tabs.get(id)
    if (!e || !/^https?:\/\//i.test(url)) return null
    const fetchText = async (u: string): Promise<string | null> => { try { const r = await e.view.webContents.session.fetch(u); return r.ok ? await r.text() : null } catch { return null } }
    return loadBundle(fetchText, url)
  })
  handle(Ch.srcPos, schemas.srcPos, async ({ id, url, line, col }) => tabs.get(id)?.cdp?.resolver.resolveFrame(undefined, line - 1, col - 1, url) ?? null)
  // Debugger: Sources paneli acikken Debugger alani etkindir (kesme noktasi, duraklatma, adimlama)
  handle(Ch.dbgEnable, schemas.tabId, ({ id }) => dbg.enable(id))
  handle(Ch.dbgDisable, schemas.tabId, ({ id }) => dbg.disable(id))
  handle(Ch.dbgBp, schemas.dbgBp, ({ id, action, bpId, ...a }) => action === 'remove' ? (bpId ? dbg.removeBreakpoint(id, bpId) : undefined) : (a.line ? dbg.setBreakpoint(id, { url: a.url, file: a.file, line: a.line, condition: a.condition }) : { error: 'no line' }))
  handle(Ch.dbgCtl, schemas.dbgCtl, ({ id, cmd }) => dbg.control(id, cmd))
  handle(Ch.dbgEvBp, schemas.dbgEvBp, ({ id, kind, name, on }) => kind === 'event' ? dbg.setEventBreakpoint(id, name, on) : dbg.setXhrBreakpoint(id, name, on))
  handle(Ch.tabSplit, schemas.tabSplit, ({ other }) => tabs.setSplit(other))
  // Oturumlar: etkin Workspace'in sekmelerini adlandirip kaydet / ac / sil
  handle(Ch.sessSave, schemas.sessSave, ({ name }) => {
    const mine = tabs.list().tabs.filter((x) => x.workspaceId === activeWorkspaceId && /^https?:\/\//.test(x.url)) // indisler yalnizca saklanan (http/https) sekmelere gore
    const act = tabs.list().activeId
    const li = mine.findIndex((x) => x.split === 'left'), ri = mine.findIndex((x) => x.split === 'right')
    const s = sessions.add(activeWorkspaceId, name, mine.map((x) => ({ url: x.url, title: x.title })), Math.max(0, mine.findIndex((x) => x.id === act)), li >= 0 && ri >= 0 ? [li, ri] : null)
    pushSessions(); return s ? s.id : null
  })
  handle(Ch.sessOpen, schemas.sessOpen, async ({ id, replace }) => {
    const s = sessions.get(activeWorkspaceId, id); if (!s) return 0
    if (replace) for (const x of tabs.list().tabs.filter((y) => y.workspaceId === activeWorkspaceId)) { proxy.drop(x.id); dbg.drop(x.id); tabs.close(x.id) }
    const ids: string[] = []
    for (const t of s.tabs) ids.push(await tabs.create({ url: t.url, workspaceId: activeWorkspaceId, activate: false }))
    tabs.activate(ids[s.active] ?? ids[0])
    if (s.split && ids[s.split[0]] && ids[s.split[1]]) { tabs.activate(ids[s.split[0]]); tabs.setSplit(ids[s.split[1]]); tabs.activate(ids[s.active] ?? ids[s.split[0]]) }
    pushTabs(); return ids.length
  })
  handle(Ch.sessDelete, schemas.sessDelete, ({ id }) => { const ok = sessions.remove(activeWorkspaceId, id); pushSessions(); return ok })
  handle(Ch.dbgExc, schemas.dbgExc, ({ id, state }) => dbg.setExceptions(id, state))
  handle(Ch.dbgScope, schemas.dbgScope, ({ id, objectId }) => dbg.scope(id, objectId))
  handle(Ch.dbgEval, schemas.dbgEval, ({ id, frameId, expression }) => dbg.evalOnFrame(id, frameId, expression))
  handle(Ch.overlay, schemas.overlay, ({ open }) => tabs.setOverlay(open))
  // Click-to-source: yalnizca source map'ten cozumlenmis dosyalar acilir
  handle(Ch.sourceOpen, schemas.sourceOpen, async ({ file, line, column, editor }) => {
    // Dosya yolu sayfanin source map'inden / derleme eklentisinden gelir (guvenilmez): yalnizca bilinen VE guvenilir bir kokun
    // (Workspace klasoru, dev sunucusunun proje klasoru, demo) altindaki dosyalar editorde acilir.
    const known = tabs.list().tabs.some((t) => {
      const e = tabs.get(t.id)
      if (!e?.cdp?.resolver.knownFiles.has(file)) return false
      return isInsideAny([workspaces.get(e.info.workspaceId)?.rootDir, e.cdp.resolver.rootProvider?.(), join(samplesDir, 'demo-src')], file)
    })
    if (!known) return false
    if (process.env.DB_SCRIPT) return true // testlerde editor baslatilmaz
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
    const fresh = next.filter((n) => !detected.some((d) => d.port === n.port))
    const firstPoll = !polledOnce; polledOnce = true
    detected = next
    // Workspace'e ait YENI dev sunucusu basladiysa (ilk tarama sayilmaz) istege bagli sekme ac
    if (settings?.get().autoOpen && !firstPoll) {
      for (const s of fresh) {
        const w = s.cwd ? workspaces.workspaceForCwd(s.cwd) : undefined
        if (w) void tabs.create({ url: `localhost:${s.port}`, workspaceId: w.id, activate: w.id === activeWorkspaceId })
      }
    }
    const byWs = new Map<string, { port: number; framework?: string }[]>()
    for (const s of next) {
      const w = s.cwd ? workspaces.workspaceForCwd(s.cwd) : undefined
      if (w) byWs.set(w.id, [...(byWs.get(w.id) ?? []), { port: s.port, framework: s.framework }])
    }
    workspaces.servers = byWs
    pushWorkspaces()
  } catch { /* lsof yoksa dedektor sessizce kapali */ }
}

/** Site izinleri: kayitli karar > (konum emulasyonu) > kullaniciya sor; bilinmeyen izinler reddedilir. */
const permissionHandlers = {
  check: (wc: Electron.WebContents | null, permission: string, origin: string, details: any): boolean => {
    if (permission === 'geolocation' && wc && tabs.isGeoEmulated(wc)) return true
    const key = permissionKey(permission, details)
    if (key === 'auto') return true
    if (!key) return false
    return perms.get(originOf(origin) || originOf(wc?.getURL() ?? ''), key) === 'allow'
  },
  request: async (wc: Electron.WebContents | null, permission: string, details: any): Promise<boolean> => {
    if (permission === 'geolocation' && wc && tabs.isGeoEmulated(wc)) return true
    const key = permissionKey(permission, details)
    if (key === 'auto') return true
    const origin = originOf(details?.requestingUrl ?? wc?.getURL() ?? '')
    if (!key || !origin) return false
    const stored = perms.get(origin, key)
    if (stored) return stored === 'allow'
    const id = `perm-${++permSeq}`
    send(Ch.permAsk, { id, origin, permission: key })
    return new Promise<boolean>((resolve) => {
      pendingPerms.set(id, (a) => { if (a === 'allow') perms.set(origin, key, 'allow'); if (a === 'block') perms.set(origin, key, 'deny'); resolve(a !== 'block') })
      setTimeout(() => { if (pendingPerms.delete(id)) resolve(false) }, 30_000)
    })
  }
}

async function createWindow(): Promise<void> {
  // Test modu (DB_SCRIPT): kullaniciyi rahatsiz etme — Dock'a dusme, one gelme, gorunmez (opacity 0) ama render ediliyor. DB_VISIBLE=1 ile normal gorunur.
  const quiet = !!process.env.DB_SCRIPT && !process.env.DB_VISIBLE
  if (quiet && process.platform === 'darwin') app.setActivationPolicy('accessory')
  const { maximized, ...ws0 } = restoreWindowState({ width: 1500, height: 900 })
  win = new BrowserWindow({
    ...ws0, ...(quiet ? { show: false, focusable: false } : {}), minWidth: 900, minHeight: 600, titleBarStyle: 'hiddenInset', backgroundColor: '#0a0a0b',
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  if (maximized && !quiet) win.maximize()
  if (quiet) { win.setOpacity(0); win.setIgnoreMouseEvents(true); win.showInactive() }
  trackWindowState(win)
  workspaces = new WorkspaceStore()
  rules = new RuleStore()
  library = new Library()
  sessions = new SessionStore()
  perms = new PermissionStore()
  settings = new SettingsStore()
  if (process.env.DB_SCRIPT) settings.set({ language: (process.env.DB_LANG as 'en' | 'tr') ?? 'en' }) // testler Ingilizce metinlere bakar
  if (process.env.DB_SCRIPT && !process.env.DB_ONBOARD) settings.set({ onboarded: true }) // testlerde karsilama ekrani sayfa gorunumlerini gizlemesin
  telemetry = new Telemetry(app.getPath('userData'), () => settings.get().telemetry, () => settings.get().installId)
  const samples = join(app.isPackaged ? process.resourcesPath : app.getAppPath(), 'samples')
  samplesDir = samples
  demo = new DemoServer(join(samples, 'demo'))
  downloads = new Downloads(() => pushLibrary())
  tabs = new TabManager(win, bus, workspaces, pushTabs, (url, wsId) => {
    // 1) sayfanin portunu dinleyen dev sunucusunun cwd'si  2) Workspace kok klasoru
    try { const port = Number(new URL(url).port); if (demo.port && port === demo.port) return join(samples, 'demo-src'); const s = detected.find((d) => d.port === port); if (s?.cwd) return s.cwd } catch { /* gecersiz url */ }
    return workspaces.get(wsId)?.rootDir ?? null
  }, (wsId) => rules.get(wsId), { detectedPorts: () => detected.map((d) => d.port), language: () => settings.get().language, onFound: (id, active, total) => send(Ch.findResult, { id, active, total }), onVisit: (u, t) => library.addVisit(u, t), onSession: (ses) => { downloads.attach(ses); lockPermissions(ses, permissionHandlers); trustLoopbackCerts(ses) } })
  installMenu((cmd) => send(Ch.cmd, cmd), settings.get().language)
  dbg = new DebuggerService((id) => { const e = tabs.get(id); return e ? { wc: e.view.webContents, resolver: e.cdp?.resolver } : null }, (id, ev) => send(Ch.dbgEvent, { id, ...ev }))
  servers = new DevServers((e) => send(Ch.srvEvent, e), (wsId, url) => { void tabs.create({ url, workspaceId: wsId, activate: wsId === activeWorkspaceId }) })
  proxy = new CdpProxy((id) => tabs.get(id)?.view.webContents ?? null, (id, method, params) => send(Ch.dtEvent, { id, method, params }))
  registerIpc()
  setInterval(() => bus.compact(), 10_000).unref()
  bus.subscribe((ev, change) => send(change === 'new' ? Ch.evNew : Ch.evUpdate, ev))

  lockShell(win, [process.env.ELECTRON_RENDERER_URL ?? 'app://shell/'])
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else { serveApp(join(__dirname, '../renderer')); await win.loadURL('app://shell/index.html') }

  const restored = process.env.DB_SCRIPT && !process.env.DB_RESTORE ? false : await tabs.restore()
  if (!restored) await newTab(process.env.DB_URL)
  void pollServers(); setInterval(pollServers, 1500)
  pushWorkspaces(); pushTabs(); pushRules(); pushLibrary(); pushSessions(); pushSettings()
  telemetry.track('app.start')

  // Otomatik test modu: DB_SCRIPT = ({ctx}) => Promise<any>; sonuc ve olaylar DB_DUMP'a yazilir
  if (process.env.DB_SCRIPT) {
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
    // betiklerin mevcut varsayilani: Timeline (arayuzun varsayilani Overview)
    await win.webContents.executeJavaScript(`new Promise((r)=>{const go=(n)=>{const b=[...document.querySelectorAll('.seg2 > button')].find(x=>x.textContent==='Timeline');if(b){b.click();r(1)}else if(n>0)setTimeout(()=>go(n-1),100);else r(0)};go(30)})`).catch(() => {})
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
app.on('before-quit', () => { library?.flush(); servers?.stopAll() })
app.on('window-all-closed', () => app.quit())
