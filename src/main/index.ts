import { GROUP_COLOR_NAMES } from '../shared/groups'
import { buildCtxMenu, type CtxItem } from '../shared/ctxmenu'
import { translateUrl } from '../shared/translate'
import { MockServer } from './mockserver'
import { engineById, searchUrl } from '../shared/search'
import { PasswordService, keychainCipher, plainCipher, type SaveAnswer } from './passwords'
import { SiteStore } from './sites'
import { siteHost, stepZoom } from '../shared/sites'
import { inSet, siteOf } from '../shared/adblock'
import { readerScript } from '../shared/reader'
import { readSafariProfile } from './importer-safari'
import { readChromeProfile } from './importer'
import { isLoopbackHost } from './security'
import { AMBIENT_SCRIPT } from '../shared/ambient'
import { AdBlocker, type AdCfg } from './adblock'
import { FaviconStore } from './favicons'
import { ThumbStore } from './thumbs'
import { TorService } from './tor'
import { remoteUrl, parseRemote } from '../shared/suggest-remote'
import { app, net, screen, BrowserWindow, clipboard, dialog, ipcMain, Menu, nativeTheme, session, shell } from 'electron'
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
import { DETECT_SCRIPT, parseDetected } from '../shared/frameworks'
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
/** tum kabuk pencereleri (id -> pencere); `win` birincil pencere */
const shellWins = new Map<number, BrowserWindow>()
/** o an IPC cagrisini yapan pencere (acilir menuler/diyaloglar icin) */
let curWin: BrowserWindow | null = null
let quitting = false
const senderWin = (wc: Electron.WebContents): BrowserWindow | undefined => { for (const w of shellWins.values()) if (!w.isDestroyed() && w.webContents === wc) return w }
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

const send = (channel: string, payload: unknown): void => { for (const w of shellWins.values()) if (!w.isDestroyed()) w.webContents.send(channel, payload) }
/** her pencereye kendi aktif sekmesi/yerlesimiyle sekme durumu */
const pushTabs = (): void => { for (const [id, w] of shellWins) if (!w.isDestroyed()) w.webContents.send(Ch.tabsState, tabs.list(id)) }
/** menu/kisayol komutu yalnizca odaktaki pencereye gider */
const sendFocused = (channel: string, payload: unknown): void => { const f = BrowserWindow.getFocusedWindow(); const w = (f && shellWins.get(f.id)) ?? win; if (w && !w.isDestroyed()) w.webContents.send(channel, payload) }
const pushSettings = (): void => send(Ch.settingsState, settings.get())
const pushRules = (): void => send(Ch.rulesState, rules.all())
const pushSessions = (): void => send(Ch.sessState, sessions.all())
const pushLibrary = (): void => send(Ch.libState, { bookmarks: Object.fromEntries(workspaces.list().map((w) => [w.id, library.bookmarks(w.id)])), downloads: downloads.list() })
const pushWorkspaces = (): void => send(Ch.wsState, { workspaces: workspaces.list(), activeId: activeWorkspaceId, detected })

/** IPC izin listesi: her kanal zod semasiyla dogrulanir; gecersiz mesaj reddedilir. */
function handle<S extends z.ZodType>(channel: string, schema: S | null, fn: (arg: z.infer<S>) => unknown): void {
  ipcMain.handle(channel, (e, raw) => {
    // yalnizca shell penceresi cagirabilir (DevTools veya baska webContents degil)
    const sw = senderWin(e.sender)
    if (!sw) throw new Error(`yetkisiz IPC gondereni: ${channel}`)
    curWin = sw; tabs?.setCurrent(sw.id)
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

let favicons: FaviconStore, thumbs: ThumbStore, sites: SiteStore, passwords: PasswordService
/** Ambient isik betigini sayfaya koyar (yerel gelistirme sayfalari haric) ve acik/kapali durumunu esitler */
async function injectAmbient(wc: Electron.WebContents): Promise<void> {
  const s = settings?.get(); if (!s || wc.isDestroyed()) return
  let host = ''; try { host = new URL(wc.getURL()).hostname } catch { return }
  if (!host || (isLoopbackHost(host) && !s.ambientDev)) return
  await wc.executeJavaScript(AMBIENT_SCRIPT + `;window.__dbAmbient.on=${s.ambient !== false}`).catch(() => {})
}
const adCfg = (): AdCfg => { const s = settings?.get(); return { level: s?.adblock ?? 'ads', allow: s?.adblockAllow ?? [], blockOnDev: !!s?.adblockDev } }
const adblock = new AdBlocker(adCfg)
const tor = new TorService(join(app.getPath('userData'), 'tor'))
async function newTab(url?: string, priv?: 'incognito' | 'tor'): Promise<string> {
  if (priv === 'tor') {
    const r = await tor.ensure()
    if (!r.ok) {
      void dialog.showMessageBox(win, { type: 'info', buttons: [tr('dlg.ok')], message: tr(r.reason === 'missing' ? 'dlg.torMissing' : 'dlg.torFailed'), detail: tr('dlg.torDetail') })
      return ''
    }
  }
  return tabs.create({ url, workspaceId: activeWorkspaceId, ...(priv ? { private: priv } : {}) })
}

function registerIpc(): void {
  handle(Ch.tabsCreate, schemas.tabsCreate, ({ url, private: priv }) => newTab(url, priv))
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
  handle(Ch.fwInfo, schemas.tabId, async ({ id }) => parseDetected(await evalInPage(id, DETECT_SCRIPT).catch(() => null)))
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
  handle(Ch.faviconsGet, schemas.faviconsGet, async ({ origins }) => {
    if (!origins.length) return favicons.all()
    await Promise.all(origins.map((o) => favicons.ensureLoopback(o)))
    return favicons.pick(origins)
  })
  handle(Ch.tabSleep, schemas.tabSleep, ({ id }) => (id ? (tabs.sleep(id) ? 1 : 0) : tabs.sleepOthers()))
  handle(Ch.reader, null, async () => { const e = tabs.active(); if (!e || !/^https?:/.test(e.view.webContents.getURL())) return 'none'; return e.view.webContents.executeJavaScript(readerScript(settings.get().language === 'tr' ? 'tr' : 'en'), true).catch(() => 'error') })
  // Reklam engelleyici menusu: bu site icin ac/kapa + genel duzey (kapali / reklamlar / reklam ve izleyiciler)
  handle(Ch.adMenu, schemas.adMenu, ({ host }) => {
    const s = settings.get(), lvl = s.adblock ?? 'ads', allow = s.adblockAllow ?? []
    const h = host.toLowerCase(), site = siteOf(h), allowed = !!h && inSet(h, new Set(allow))
    const apply = (patch: Parameters<typeof settings.set>[0]): void => { settings.set(patch); tabs.refreshRules(); pushSettings(); const a = tabs.active(); if (a) tabs.reload(a.info.id) }
    const items: Electron.MenuItemConstructorOptions[] = []
    if (h && lvl !== 'off') {
      items.push({ label: tr(allowed ? 'ad.menu.siteOn' : 'ad.menu.siteOff', { h: site }), click: () => apply({ adblockAllow: allowed ? allow.filter((x) => !(h === x || h.endsWith('.' + x))) : [...allow, site] }) }, { type: 'separator' })
    }
    for (const [v, k] of [['off', 'ad.lvl.off'], ['ads', 'ad.lvl.ads'], ['strict', 'ad.lvl.strict']] as const) items.push({ label: tr(k), type: 'radio', checked: lvl === v, click: () => apply({ adblock: v }) })
    Menu.buildFromTemplate(items).popup({ window: curWin ?? win })
  })
  handle(Ch.winNew, null, () => openWindow())
  // Sekmeyi diger pencereye gonder (yalniz bir pencere varsa ikinciyi acar); baska penceredeki sekme ise buraya getirir
  handle(Ch.tabHop, schemas.tabHop, async ({ id }) => {
    const e = tabs.get(id); if (!e) return false
    const here = tabs.currentWinId
    const target = e.winId !== here ? here : (tabs.windowIds().find((x) => x !== here) ?? await openWindow())
    return tabs.moveToWindow(id, target)
  })
  handle(Ch.tabMute, schemas.tabMute, ({ id, muted }) => tabs.setMuted(id, muted))
  // Site ayarlari (yakinlastirma, zorla karanlik, kullanici CSS'i)
  const siteOfTab = (id: string): { host: string; wc: Electron.WebContents } | null => { const e = tabs.get(id); const h = e && siteHost(e.view.webContents.getURL()); return e && h ? { host: h, wc: e.view.webContents } : null }
  const applyHost = (host: string): void => { tabs.each((wc) => { if (siteHost(wc.getURL()) === host) void sites.apply(wc) }); tabs.refreshSites() }
  handle(Ch.siteGet, schemas.siteGet, ({ id }) => { const s = siteOfTab(id); return s ? { host: s.host, ...sites.get(s.host) } : null })
  handle(Ch.siteSet, schemas.siteSet, ({ id, ...p }) => { const s = siteOfTab(id); if (!s) return false; sites.set(s.host, { ...sites.get(s.host), ...p }); applyHost(s.host); pushTabs(); return true })
  handle(Ch.zoom, schemas.zoom, ({ id, dir }) => { const s = siteOfTab(id); if (!s) return 1; const z = stepZoom(sites.get(s.host).zoom ?? 1, dir); sites.set(s.host, { ...sites.get(s.host), zoom: z }); applyHost(s.host); return z })
  handle(Ch.siteClear, schemas.siteClear, async ({ id }) => { const s = siteOfTab(id); if (!s) return false; await s.wc.session.clearStorageData({ origin: new URL(s.wc.getURL()).origin }); s.wc.reload(); return true })
  // Sifre yoneticisi (sifreler arayuze gonderilmez; panoya kopyalama yalnizca kabuktan istenir)
  handle(Ch.pwList, null, () => ({ logins: passwords.list(), never: passwords.never() }))
  handle(Ch.pwDelete, schemas.pwDelete, ({ origin, username }) => passwords.remove(origin, username))
  handle(Ch.pwCopy, schemas.pwDelete, ({ origin, username }) => passwords.copy(origin, username))
  handle(Ch.pwNeverRemove, schemas.pwNever, ({ origin }) => passwords.removeNever(origin))
  handle(Ch.pwFill, schemas.pwFill, async ({ id }) => { const e = tabs.get(id); return e ? passwords.fill(e.view.webContents) : false })
  // Sayfa gorunumu gizlenmeden once anlik goruntusu: kabuk bunu gosterir, boylece sayfa kararmaz (surukleme, palet, ayarlar)
  handle(Ch.snapPage, null, async () => {
    const e = tabs.active(); const wc = e?.view.webContents
    if (!e || !wc || wc.isDestroyed() || e.lab || !/^https?:/.test(wc.getURL())) return null
    const img = await Promise.race([wc.capturePage(), new Promise<null>((r) => setTimeout(() => r(null), 400))]).catch(() => null)
    if (!img || img.isEmpty()) return null
    const sz = img.getSize(), scale = screen.getDisplayMatching((curWin ?? win).getBounds()).scaleFactor || 1
    return { url: `data:image/jpeg;base64,${img.toJPEG(72).toString('base64')}`, w: Math.round(sz.width / scale), h: Math.round(sz.height / scale) }
  })
  handle(Ch.printPage, schemas.printPage, ({ mode }) => { const e = tabs.active(); return e ? pageOutput(e.view.webContents, mode) : null })
  // Gecmis sayfasi + tarama verilerini temizleme
  handle(Ch.libVisits, schemas.libVisits, ({ q, limit }) => library.visits(q ?? '', limit ?? 1500))
  handle(Ch.libDelete, schemas.libDelete, ({ url, ts }) => { const n = library.removeVisits(url, ts); pushLibrary(); return n })
  handle(Ch.dataClear, schemas.dataClear, async ({ range, history, cookies, cache }) => {
    const since = range === 'all' ? 0 : Date.now() - (range === 'hour' ? 3_600_000 : range === 'day' ? 86_400_000 : 7 * 86_400_000)
    let n = 0
    if (history) { n = library.clearSince(since); pushLibrary() }
    if (cookies || cache) {
      const parts = [...workspaces.list().map((w) => partitionFor(w.id)), 'incog-main']
      for (const p of parts) {
        const ses = session.fromPartition(p)
        if (cookies) await ses.clearStorageData({ storages: ['cookies', 'localstorage', 'indexdb', 'serviceworkers', 'cachestorage'] }).catch(() => {})
        if (cache) await ses.clearCache().catch(() => {})
      }
    }
    return { history: n }
  })
  // Yer imi yoneticisi + cubuk menuleri
  handle(Ch.bmUpdate, schemas.bmUpdate, ({ url, newUrl, ...p }) => { const ok = library.updateBookmark(activeWorkspaceId, url, { ...p, ...(newUrl !== undefined ? { url: newUrl } : {}) }); pushLibrary(); return ok })
  handle(Ch.bmRemove, schemas.bmRemove, ({ url }) => { library.removeBookmark(activeWorkspaceId, url); pushLibrary() })
  handle(Ch.bmFolder, schemas.bmFolder, ({ name, to }) => { library.editFolder(activeWorkspaceId, name, to); pushLibrary() })
  handle(Ch.bmMenu, schemas.bmMenu, ({ folder, url }) => {
    const ws = activeWorkspaceId, here = tabs.active()
    const go = (u: string, newTab: boolean): void => { if (newTab || !here) void newTab_(u); else tabs.go(here.info.id, u) }
    const newTab_ = (u: string): Promise<string> => newTab(u)
    if (url) { // tek yer imi: sag tik menusu
      Menu.buildFromTemplate([
        { label: tr('bm.openNew'), click: () => go(url, true) }, { label: tr('bm.openPrivate'), click: () => void newTab(url, 'incognito') },
        { type: 'separator' }, { label: tr('bm.delete'), click: () => { library.removeBookmark(ws, url); pushLibrary() } }
      ]).popup({ window: curWin ?? win }); return
    }
    const items = library.bookmarks(ws).filter((b) => (folder ? b.folder === folder : !b.folder))
    Menu.buildFromTemplate(items.length ? items.map((b) => ({ label: (b.title || b.url).slice(0, 60), click: () => go(b.url, false) })) : [{ label: tr('bm.empty'), enabled: false }]).popup({ window: curWin ?? win })
  })
  // Sekme gruplari: 'new' degil, gercek grup kimligi ya da null; yeni grup icin tabGroup ile 'new' gonderilir
  handle(Ch.tabGroup, schemas.tabGroup, ({ id, group }) => tabs.setGroup(id, group === 'new' ? tabs.createGroup() : group))
  handle(Ch.groupUpdate, schemas.groupUpdate, ({ id, ...p }) => tabs.updateGroup(id, p))
  handle(Ch.groupMenu, schemas.groupMenu, ({ id }) => {
    Menu.buildFromTemplate([
      ...GROUP_COLOR_NAMES.map((c) => ({ label: tr(`gc.${c}` as Key), type: 'radio' as const, checked: tabs.list().groups.find((g) => g.id === id)?.color === c, click: () => tabs.updateGroup(id, { color: c }) })),
      { type: 'separator' }, { label: tr('grp.ungroup'), click: () => tabs.ungroup(id) }, { label: tr('grp.close'), click: () => tabs.closeGroup(id) }
    ]).popup({ window: curWin ?? win })
  })
  handle(Ch.tabPin, schemas.tabPin, ({ id, pinned }) => tabs.setPinned(id, pinned))
  handle(Ch.pip, null, async () => {
    const e = tabs.active(); if (!e) return 'none'
    return e.view.webContents.executeJavaScript(`(async()=>{try{if(document.pictureInPictureElement){await document.exitPictureInPicture();return 'exit'}
      const v=[...document.querySelectorAll('video')].filter(x=>x.readyState>=2&&!x.disablePictureInPicture).sort((a,b)=>b.videoWidth*b.videoHeight-a.videoWidth*a.videoHeight)[0]
      if(!v) return 'none'; await v.requestPictureInPicture(); return 'ok'}catch(e){return 'error'}})()`, true).catch(() => 'error')
  })
  handle(Ch.importSafari, null, () => {
    const r = readSafariProfile(process.env.DB_SAFARI_DIR || undefined)
    if (!r.ok) { if (r.reason === 'denied') void shell.openExternal('x-apple.systempreferences:com.apple.preference.security?Privacy_AllFiles'); return r.reason === 'denied' ? 'denied' : null }
    const x = library.importData(activeWorkspaceId, r.data.bookmarks, r.data.visits); pushLibrary(); return x
  })
  handle(Ch.defaultBrowser, schemas.defaultBrowser, ({ set }) => {
    if (set) { app.setAsDefaultProtocolClient('http'); app.setAsDefaultProtocolClient('https') }
    return app.isDefaultProtocolClient('http') && app.isDefaultProtocolClient('https')
  })
  handle(Ch.importChrome, null, () => {
    const d = readChromeProfile(process.env.DB_CHROME_DIR || undefined); if (!d) return null
    const r = library.importData(activeWorkspaceId, d.bookmarks, d.visits); pushLibrary(); return r
  })
  handle(Ch.suggestRemote, schemas.suggestRemote, async ({ q }) => {
    const s = settings.get(); if (s.searchSuggest === false) return []
    const u = remoteUrl(s.searchEngine ?? 'duckduckgo', q); if (!u) return []
    try {
      const r = await net.fetch(u, { signal: AbortSignal.timeout(1500), credentials: 'omit', headers: { 'user-agent': 'Mozilla/5.0' } })
      if (!r.ok) return []
      return parseRemote(JSON.parse((await r.text()).slice(0, 20_000)))
    } catch { return [] }
  })
  handle(Ch.thumbGet, schemas.thumbGet, async ({ url }) => thumbs.get(url) ?? (await thumbs.captureHidden(url)))
  handle(Ch.bookmarkToggle, schemas.tabId, ({ id }) => {
    const e = tabs.get(id); if (!e) return false
    const on = library.toggleBookmark(e.info.workspaceId, e.view.webContents.getURL(), e.view.webContents.getTitle())
    pushLibrary(); return on
  })
  handle(Ch.downloadShow, schemas.downloadShow, ({ id }) => downloads.show(id))
  handle(Ch.settingsGet, null, () => settings.get())
  handle(Ch.settingsSet, schemas.settingsSet, (p) => { const before = settings.get().language; settings.set(p); if (p.adblock !== undefined || p.adblockAllow !== undefined) tabs.refreshRules(); if (p.spellcheck !== undefined) tabs.each((wc) => wc.session.setSpellCheckerEnabled(p.spellcheck!)); if (p.ambient !== undefined) tabs.each((wc) => void wc.executeJavaScript(`window.__dbAmbient&&(window.__dbAmbient.on=${p.ambient})`).catch(() => {})); if (p.language && p.language !== before) installMenu((cmd) => sendFocused(Ch.cmd, cmd), settings.get().language); pushSettings(); return settings.get() })
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
      ...(e.info.pinned ? [] : [{ label: tr('grp.addTo'), submenu: [
        { label: tr('grp.new'), click: () => { tabs.setGroup(id, tabs.createGroup()) } },
        ...tabs.list().groups.map((g) => ({ label: g.name || tr(`gc.${g.color}` as Key), click: () => { tabs.setGroup(id, g.id) } })),
        ...(e.info.group ? [{ type: 'separator' as const }, { label: tr('grp.remove'), click: () => { tabs.setGroup(id, null) } }] : [])
      ] }]),
      { label: tr(e.info.muted ? 'ctx.unmute' : 'ctx.mute'), click: () => tabs.setMuted(id, !e.info.muted) },
      { label: tr(e.info.pinned ? 'ctx.unpin' : 'ctx.pin'), click: () => tabs.setPinned(id, !e.info.pinned) },
      { label: tr('ctx.reload'), click: () => tabs.reload(id) },
      { label: tr('ctx.sleep'), enabled: id !== tabs.active()?.info.id && !e.info.sleeping, click: () => { tabs.sleep(id) } },
      { label: tr('ctx.duplicate'), click: () => void tabs.duplicate(id) },
      ...(tabs.active() && tabs.active()!.info.id !== id ? [{ label: tabs.splitIds.includes(id) ? tr('ctx.unsplit') : tr('ctx.split'), click: () => { if (tabs.splitIds.includes(id)) tabs.setSplit(null); else tabs.setSplit(id) } }] : []),
      { label: tr('ctx.copyUrl'), enabled: !!url, click: () => clipboard.writeText(url) },
      { label: library.isBookmarked(e.info.workspaceId, url) ? tr('ctx.unbookmark') : tr('ctx.bookmark'), enabled: /^https?:/.test(url), click: () => { library.toggleBookmark(e.info.workspaceId, url, e.view.webContents.getTitle()); pushLibrary() } },
      { type: 'separator' },
      { label: tr('ctx.close'), click: () => { proxy.drop(id); tabs.close(id) } },
      { label: tr('ctx.closeOthers'), click: () => { tabs.closeOthers(id) } },
      { label: tr('ctx.closeRight'), click: () => { tabs.closeOthers(id, true) } }
    ]).popup({ window: curWin ?? win })
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

/** Yazdir / PDF olarak kaydet / sayfayi kaydet (HTML). Dosya yolunu doner (yazdirmada null). Testte DB_OUT_DIR ile pencere acilmaz. */
async function pageOutput(wc: Electron.WebContents, mode: 'print' | 'pdf' | 'save'): Promise<string | null> {
  if (wc.isDestroyed() || !/^https?:/.test(wc.getURL())) return null
  if (mode === 'print') { wc.print({ silent: false, printBackground: true }); return null }
  const base = (wc.getTitle() || new URL(wc.getURL()).hostname).replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80)
  const ext = mode === 'pdf' ? 'pdf' : 'html'
  let file: string | undefined
  if (process.env.DB_OUT_DIR) file = join(process.env.DB_OUT_DIR, `${base}.${ext}`)
  else {
    const r = await dialog.showSaveDialog(curWin ?? win, { defaultPath: join(app.getPath('downloads'), `${base}.${ext}`), filters: [{ name: mode === 'pdf' ? 'PDF' : 'HTML', extensions: [ext] }] })
    file = r.canceled ? undefined : r.filePath
  }
  if (!file) return null
  if (mode === 'pdf') writeFileSync(file, await wc.printToPDF({ printBackground: true, preferCSSPageSize: true }))
  else await wc.savePage(file, 'HTMLComplete')
  return file
}

/** Sayfa sag-tik menusu: tanim shared/ctxmenu.ts'te, burada native menuye cevrilir */
const viewSourceServer = new MockServer()
async function showCtx(tabId: string, p: Electron.ContextMenuParams): Promise<void> {
  const e = tabs.get(tabId); if (!e) return
  const wc = e.view.webContents, owner = shellWins.get(e.winId) ?? win
  const engine = engineById(settings.get().searchEngine)
  const items = buildCtxMenu({ ...p, pageURL: wc.getURL(), canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward(), editFlags: p.editFlags })
  const open = (url: string, priv?: 'incognito' | 'tor'): void => { void tabs.create({ url, workspaceId: e.info.workspaceId, winId: e.winId, ...((priv ?? e.info.private) ? { private: priv ?? e.info.private } : {}) }) }
  const run = async (it: CtxItem): Promise<void> => {
    const a = it.arg ?? ''
    switch (it.act) {
      case 'back': wc.navigationHistory.goBack(); break
      case 'forward': wc.navigationHistory.goForward(); break
      case 'reload': wc.reload(); break
      case 'linkNewTab': case 'imgNewTab': open(a); break
      case 'linkNewPrivate': open(a, 'incognito'); break
      case 'linkCopy': case 'imgCopyUrl': case 'mediaCopyUrl': clipboard.writeText(a); break
      case 'imgCopy': wc.copyImageAt(p.x, p.y); break
      case 'imgSave': case 'mediaSave': wc.downloadURL(a); break
      case 'mediaPip': void wc.executeJavaScript(`(async()=>{const v=[...document.querySelectorAll('video')].sort((a,b)=>b.videoWidth-a.videoWidth)[0]; if(v) await v.requestPictureInPicture()})()`, true).catch(() => {}); break
      case 'cut': wc.cut(); break
      case 'copy': wc.copy(); break
      case 'paste': wc.paste(); break
      case 'selectAll': wc.selectAll(); break
      case 'search': open(searchUrl(settings.get().searchEngine, a)); break
      case 'suggest': wc.replaceMisspelling(a); break
      case 'addWord': wc.session.addWordToSpellCheckerDictionary(a); break
      case 'savePage': void pageOutput(wc, 'save'); break
      case 'print': void pageOutput(wc, 'print'); break
      case 'savePdf': void pageOutput(wc, 'pdf'); break
      case 'translate': tabs.go(tabId, translateUrl(wc.getURL(), settings.get().language)); break
      case 'qr': owner.webContents.send(Ch.cmd, 'qr.open'); break
      case 'inspect': wc.inspectElement(p.x, p.y); break
      case 'viewSource': {
        const raw = await net.fetch(wc.getURL(), { signal: AbortSignal.timeout(8000) }).then((r) => r.text()).catch(() => '')
        const body = raw || await wc.executeJavaScript('document.documentElement.outerHTML').catch(() => '')
        open(await viewSourceServer.url({ status: 200, body: String(body).slice(0, 3_000_000), contentType: 'text/plain; charset=utf-8' })); break
      }
    }
  }
  const label = (it: CtxItem): string => it.act === 'suggest' ? (it.arg ?? '') : it.act === 'addWord' ? tr('cm.addWord') : it.act === 'search' ? tr('cm.search', { engine: engine.label, q: (it.arg ?? '').slice(0, 30) }) : tr((it.label ?? `cm.${it.act}`) as Key)
  const tpl: Electron.MenuItemConstructorOptions[] = items.map((it) => (it.sep ? { type: 'separator' as const } : { label: label(it), enabled: it.enabled !== false, ...(it.act === 'suggest' ? { } : {}), click: () => void run(it) }))
  Menu.buildFromTemplate(tpl).popup({ window: owner })
}

/** Kabuk penceresi kapaniyorsa sekmeleri kalan pencereye tasir (uygulama kapanirken oturum bozulmasin diye atlanir) */
function onShellClose(w: BrowserWindow): void {
  if (quitting || shellWins.size <= 1) { shellWins.delete(w.id); return }
  const fallback = [...shellWins.values()].find((x) => x.id !== w.id && !x.isDestroyed())
  if (fallback) tabs.removeWindow(w.id, fallback.id)
  shellWins.delete(w.id)
  if (win === w && fallback) win = fallback
  pushTabs()
}

/** Ikinci (ve sonraki) kabuk penceresi: sekme havuzu ortak; tercihen diger monitorde acilir. */
async function openWindow(): Promise<number> {
  const quiet = !!process.env.DB_SCRIPT && !process.env.DB_VISIBLE
  const here = screen.getDisplayMatching(win.getBounds()), other = screen.getAllDisplays().find((d) => d.id !== here.id)
  const wa = (other ?? here).workArea
  const def = other ? { x: wa.x + 40, y: wa.y + 40, width: Math.max(900, wa.width - 80), height: Math.max(600, wa.height - 80) } : { x: wa.x + Math.floor(wa.width / 2), y: wa.y + 40, width: Math.max(900, Math.floor(wa.width / 2) - 20), height: Math.max(600, wa.height - 80) }
  const { maximized, ...b } = restoreWindowState(def, 'window2')
  const w = new BrowserWindow({ ...b, ...(quiet ? { show: false, focusable: false } : {}), minWidth: 900, minHeight: 600, titleBarStyle: 'hiddenInset', backgroundColor: '#00000000', vibrancy: 'under-window', visualEffectState: 'active', webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  w.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  if (maximized && !quiet) w.maximize()
  if (quiet) { w.setOpacity(0); w.setIgnoreMouseEvents(true); w.showInactive() }
  trackWindowState(w, 'window2')
  shellWins.set(w.id, w); w.on('close', () => onShellClose(w))
  const id = tabs.addWindow(w)
  lockShell(w, [process.env.ELECTRON_RENDERER_URL ?? 'app://shell/'])
  await w.loadURL(process.env.ELECTRON_RENDERER_URL ?? 'app://shell/index.html')
  pushWorkspaces(); pushTabs(); pushRules(); pushLibrary(); pushSessions(); pushSettings()
  return id
}

async function createWindow(): Promise<void> {
  // Test modu (DB_SCRIPT): kullaniciyi rahatsiz etme — Dock'a dusme, one gelme, gorunmez (opacity 0) ama render ediliyor. DB_VISIBLE=1 ile normal gorunur.
  nativeTheme.themeSource = 'dark' // cam (vibrancy) her zaman koyu
  const quiet = !!process.env.DB_SCRIPT && !process.env.DB_VISIBLE
  if (quiet && process.platform === 'darwin') app.setActivationPolicy('accessory')
  const { maximized, ...ws0 } = restoreWindowState({ width: 1500, height: 900 })
  win = new BrowserWindow({
    ...ws0, ...(quiet ? { show: false, focusable: false } : {}), minWidth: 900, minHeight: 600, titleBarStyle: 'hiddenInset', backgroundColor: '#00000000', vibrancy: 'under-window', visualEffectState: 'active', // macOS cam: masaustu bulanik gorunur, shell kartlari saydam
    
    webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false }
  })
  win.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {}) // kabuk (arayuz) yakinlastirilamaz; yalnizca sayfalar
  if (maximized && !quiet) win.maximize()
  if (quiet) { win.setOpacity(0); win.setIgnoreMouseEvents(true); win.showInactive() }
  trackWindowState(win)
  shellWins.set(win.id, win); win.on('close', () => onShellClose(win))
  workspaces = new WorkspaceStore()
  rules = new RuleStore()
  library = new Library()
  sites = new SiteStore()
  passwords = new PasswordService(app.getPath('userData'), process.env.DB_SCRIPT ? plainCipher : keychainCipher, {
    isPrivate: (wc) => tabs.isPrivateWc(wc),
    changed: () => tabs?.refreshSites(),
    ask: async (_wc, origin, username, update) => {
      if (process.env.DB_SCRIPT) return (process.env.DB_PW_ANSWER as SaveAnswer) || 'save' // testlerde yerel pencere acilmaz
      const parent = BrowserWindow.getFocusedWindow() ?? win
      const r = await dialog.showMessageBox(parent, { type: 'question', buttons: [tr(update ? 'pw.update' : 'pw.save'), tr('pw.later'), tr('pw.never')], defaultId: 0, cancelId: 1, message: tr(update ? 'pw.askUpdate' : 'pw.ask', { u: username || origin }), detail: `${origin}\n${tr('pw.keychain')}` })
      return r.response === 0 ? 'save' : r.response === 2 ? 'never' : 'later'
    },
    pick: (_wc, names) => new Promise<number>((resolve) => {
      let done = false
      const m = Menu.buildFromTemplate(names.map((n, i) => ({ label: n || tr('pw.noUser'), click: () => { done = true; resolve(i) } })))
      m.popup({ window: BrowserWindow.getFocusedWindow() ?? win, callback: () => { if (!done) resolve(-1) } })
    })
  })
  favicons = new FaviconStore(app.getPath('userData'), (origin, url) => send(Ch.faviconNew, { origin, url })); thumbs = new ThumbStore(app.getPath('userData'))
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
  }, (wsId) => rules.get(wsId), { detectedPorts: () => detected.map((d) => d.port), language: () => settings.get().language, searchEngine: () => settings.get().searchEngine ?? 'duckduckgo', onFavicons: (ses, u, urls) => void favicons.capture(ses, u, urls), onThumb: (u, wc) => { if (!thumbs.recentlyHas(u, 60_000)) void wc.capturePage().then((img) => thumbs.put(u, img)).catch(() => {}) }, onDomReady: (wc) => { void sites.apply(wc); void adblock.cosmetic(wc); void adblock.consent(wc, settings.get().cookieBanners !== false); void injectAmbient(wc) }, sleepMinutes: () => settings.get().sleepMinutes ?? 30, onContextMenu: (id, params) => void showCtx(id, params), loginCount: (url) => passwords?.count(url) ?? 0, onAttached: (wc) => passwords?.attach(wc), siteInfo: (url) => { const h = siteHost(url); const s = h ? sites.get(h) : undefined; return s && (s.zoom || s.dark) ? { ...(s.zoom ? { zoom: s.zoom } : {}), ...(s.dark ? { dark: true } : {}) } : undefined }, stripTracking: () => ({ on: settings.get().stripTracking !== false, dev: !!settings.get().stripTrackingDev }), adCfg, onFocusWindow: (w) => { if (!process.env.DB_SCRIPT || process.env.DB_VISIBLE) { if (w.isMinimized()) w.restore(); w.focus() } }, openWindow, torPort: async () => { const r = await tor.ensure(); return r.ok ? r.port : null }, onFound: (id, active, total) => send(Ch.findResult, { id, active, total }), onVisit: (u, t) => library.addVisit(u, t), onSession: (ses) => { ses.setSpellCheckerEnabled(settings.get().spellcheck !== false); if (process.platform !== 'darwin') ses.setSpellCheckerLanguages(settings.get().language === 'tr' ? ['tr', 'en-US'] : ['en-US']); downloads.attach(ses); lockPermissions(ses, permissionHandlers); trustLoopbackCerts(ses) } })
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
    await win.webContents.executeJavaScript(`new Promise((r)=>{const go=(n)=>{const pt=document.querySelector('.panel-toggle');if(pt&&pt.getAttribute('aria-pressed')==='false')pt.click();const b=[...document.querySelectorAll('.seg2 > button')].find(x=>x.textContent==='Timeline');if(b){b.click();r(1)}else if(n>0)setTimeout(()=>go(n-1),100);else r(0)};go(30)})`).catch(() => {})
    const ctx = {
      app, win, tabs, bus, library, downloads, handleLaunch, settings, telemetry, demo, exportReport: (p: string) => exportReport(win, tabs, bus, (id) => workspaces.get(id)?.name ?? id, p), workspaces, rules, sleep, refreshRules: () => { tabs.refreshRules(); pushRules() }, detected: () => detected, pushTabs, detectServers,
      newTab, openWindow, shellWins, passwords,
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
app.on('before-quit', () => { quitting = true; library?.flush(); favicons?.flush(); thumbs?.flush(); servers?.stopAll(); tor.stop() })
app.on('window-all-closed', () => app.quit())
