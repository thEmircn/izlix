import { networkInterfaces } from 'node:os'
import { lanUrl, pickLanIp } from '../shared/lan'
import { mergeShortcuts } from '../shared/shortcuts'
import { matchesTitle, rankTabs, searchText, type TabHit } from '../shared/tabsearch'
import { editorCommand, editorUrl } from '../shared/editor'
import { GROUP_COLOR_NAMES } from '../shared/groups'
import { buildCtxMenu, type CtxItem } from '../shared/ctxmenu'
import { translateUrl } from '../shared/translate'
import { MockServer } from './mockserver'
import { engineById, searchUrl } from '../shared/search'
import { Recorder } from './recorder'
import { Replayer } from './replay'
import { StateBridge } from './statebridge'
import { Speaker } from './speak'
import { NoteStore } from './notes'
import { UsageStore } from './usage'
import { PerfHistory } from './perfhist'
import { AiService } from './ai'
import { buildAiContext, needsKey, type AiConfig } from '../shared/ai'
import { WidgetService } from './widgets'
import { parseReminder } from '../shared/widgets'
import { FocusServer } from './focus'
import { blockReason, lastDays } from '../shared/usage'
import { siteOf as siteOfUsage } from '../shared/adblock'
import { CAPTURE_SELECTION, applyNotesScript, pageKey, removeNoteScript } from '../shared/notes'
import { screenAtPoint } from '../shared/screenpick'
import { DEFAULT_HUB, SERVICES, nextUnread, serviceById, serviceUrl, type HubSettings } from '../shared/services'
import { ThreatService } from './threat'
import { checkUpdate, updateInfo } from './updatecheck'
import { migrateLegacyData } from './migrate'
import { SyncService, deviceName, icloudDir } from './sync'
import { mergeBookmarks, mergeNotes, mergeSites, pickSettings, type SyncPayload } from '../shared/sync'
import { loadDoc as loadDocS, saveDoc as saveDocS } from './docdb'
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
import { app, nativeImage, systemPreferences, net, screen, desktopCapturer, powerMonitor, Notification, BrowserWindow, WebContentsView, clipboard, dialog, ipcMain, Menu, nativeTheme, session, shell } from 'electron'
import { join } from 'node:path'
import { existsSync, mkdirSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import { z } from 'zod'
import { Ch, schemas } from '../shared/ipc'
import type { Editor } from '../shared/events'
import { EventBus } from '../core/bus'
import { TabManager } from './tabs'
import { RuleStore } from './rules'
import { PermissionStore, originOf, permissionKey, type PermKey } from './permissions'
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
import { CdpProxy } from '../core/cdpproxy'
import { electronCdp } from './electron-cdp'
import { DevServers } from './devserver'
import { DebuggerService } from '../core/debugger'
import { A11Y_AUDIT } from './a11y-audit'
import { CSS_SNAPSHOT } from './css-snapshot'
import { SEO_SCRIPT } from './seo-script'
import { IMAGE_AUDIT, LINK_CHECK } from './page-tools'
import { loadBundle } from './source-bundle'
import { captureShot, shotName } from './shots'
import { formatEval } from '../core/evalformat'
import { exportReport } from './report'
import { installMenu } from './menu'
import { WorkspaceStore, detectServers, partitionFor, type DetectedServer } from './workspace'

// Test/izolasyon: calisma verisini ayri bir dizine yonlendir (gercek kullanici verisine dokunmaz)
if (process.env.DB_USER_DATA) { app.setPath('userData', process.env.DB_USER_DATA); app.setPath('downloads', join(process.env.DB_USER_DATA, 'downloads')) }
else { try { migrateLegacyData(app.getPath('appData')) } catch { /* tasima basarisizsa yeni bos klasorle devam */ } }

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
const pendingPerms = new Map<string, (a: 'allow-once' | 'allow' | 'block' | 'dismiss') => void>()
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

const send = (channel: string, payload: unknown): void => { for (const w of shellWins.values()) if (!w.isDestroyed()) w.webContents.send(channel, payload) }
/** her pencereye kendi aktif sekmesi/yerlesimiyle sekme durumu */
const pushTabs = (): void => { for (const [id, w] of shellWins) if (!w.isDestroyed()) w.webContents.send(Ch.tabsState, tabs.list(id)) }
/** menu/kisayol komutu yalnizca odaktaki pencereye gider */
const sendFocused = (channel: string, payload: unknown): void => { const f = BrowserWindow.getFocusedWindow(); const w = (f && shellWins.get(f.id)) ?? win; if (w && !w.isDestroyed()) w.webContents.send(channel, payload) }
// --- iCloud Drive esitleme (uctan uca sifreli, sunucusuz) ---
interface SyncSt { enabled: boolean; last: number; error: string; pass: string }
let syncSt: SyncSt = { enabled: false, last: 0, error: '', pass: '' }
const syncCipher = (): typeof keychainCipher => (process.env.DB_SCRIPT ? plainCipher : keychainCipher)
const syncPass = (): string | null => { try { return syncSt.pass ? syncCipher().decrypt(syncSt.pass) : null } catch { return null } }
const saveSyncSt = (): void => { saveDocS(app.getPath('userData'), 'syncstate', syncSt) }
let syncSvc: SyncService
function buildSync(): SyncPayload {
  const bookmarks: SyncPayload['bookmarks'] = {}
  for (const w of workspaces.list()) { const l = library.bookmarks(w.id); if (l.length) bookmarks[w.name] = l.map((b) => ({ ...b })) }
  return { v: 1, ts: Date.now(), device: deviceName(), bookmarks, notes: notes.all(), sites: sites.all() as SyncPayload['sites'], settings: pickSettings(settings.get() as unknown as Record<string, unknown>) }
}
function applySync(r: SyncPayload): void {
  for (const w of workspaces.list()) { const rb = r.bookmarks[w.name]; if (rb) { library.setBookmarks(w.id, mergeBookmarks(library.bookmarks(w.id), rb)) } }
  notes.replaceAll(mergeNotes(notes.all(), r.notes))
  const ms = mergeSites(sites.all() as Record<string, Record<string, unknown>>, r.sites); for (const [h, v] of Object.entries(ms)) if (!(h in sites.all())) sites.set(h, v as never)
  // ayarlar: yalniz uzak dosya bu cihazin son esitlemesinden yeniyse uygulanir (yerel degisiklik ezilmesin)
  if (r.ts > syncSt.last && r.device !== deviceName()) { settings.set(r.settings as never); pushSettings() }
  library.flush(); notes.flush(); pushLibrary()
}
function runSync(): { ok: boolean; error?: string; pulled?: boolean } {
  const r = syncSvc.run()
  syncSt.error = r.ok ? '' : r.error ?? 'error'; if (r.ok) syncSt.last = r.ts ?? Date.now(); saveSyncSt()
  return r
}
// --- Hub: gunluk uygulamalar (her biri ayri kalici oturumda) ---
const hubCfg = (): HubSettings => ({ ...DEFAULT_HUB, ...(settings.get().hub ?? {}) })
/** Servisi acar/one getirir; background: sekme olusturur ama etkinlestirmez. */
async function hubOpen(id: string, background = false): Promise<'ok' | 'no-url' | 'unknown'> {
  const svc = serviceById(id); if (!svc) return 'unknown'
  const url = serviceUrl(svc, hubCfg()); if (!url) return 'no-url'
  const ex = tabs.list().tabs.find((t) => t.service === id)
  if (ex) { if (!background) { if (ex.workspaceId !== activeWorkspaceId) { activeWorkspaceId = ex.workspaceId; pushWorkspaces(); pushRules() } tabs.activate(ex.id); pushTabs() } return 'ok' }
  await tabs.create({ url, workspaceId: activeWorkspaceId, service: id, activate: !background })
  return 'ok'
}
async function hubAutostart(): Promise<void> {
  const h = hubCfg(); if (!h.autostart) return
  for (const id of h.enabled) await hubOpen(id, true).catch(() => {})
}
let lastBadge = -1
function updateBadge(): void {
  const n = tabs.list().tabs.reduce((a, t) => a + (t.service ? t.unread ?? 0 : 0), 0)
  if (n === lastBadge) return; lastBadge = n
  if (process.env.DB_SCRIPT) return
  try {
    if (process.platform === 'darwin') app.dock?.setBadge(n ? (n > 99 ? '99+' : String(n)) : '')
    else if (process.platform === 'linux') app.setBadgeCount(n) // Unity/KDE baslatici rozeti
    else if (process.platform === 'win32') {
      // gorev cubugu simgesi uzerinde turuncu nokta (sayi cizilemez; aciklama metninde sayi var)
      const px = Buffer.alloc(16 * 16 * 4)
      for (let y = 0; y < 16; y++) for (let x = 0; x < 16; x++) { const inside = (x - 7.5) ** 2 + (y - 7.5) ** 2 <= 49, o = (y * 16 + x) * 4; px[o] = 43; px[o + 1] = 106; px[o + 2] = 255; px[o + 3] = inside ? 255 : 0 } // BGRA
      const dot = nativeImage.createFromBitmap(px, { width: 16, height: 16 })
      for (const w of shellWins.values()) if (!w.isDestroyed()) w.setOverlayIcon(n ? dot : null, n ? `${n} unread` : '')
    }
  } catch { /* rozet kritik degil */ }
}
const loadedParts = new Set<string>()
/** kayitli eklentileri bir oturuma yukler (gizli/Tor oturumlari haric); hatali olan sessizce atlanir */
async function loadExtensionsInto(ses: Electron.Session, part: string): Promise<void> {
  if (part.startsWith('incog') || part.startsWith('tor')) return
  loadedParts.add(part)
  for (const dir of settings?.get().extensions ?? []) { if (ses.getAllExtensions().some((e) => e.path === dir)) continue; await ses.loadExtension(dir).catch(() => {}) }
}
async function loadExtensionAll(dir: string): Promise<{ ok: boolean; error?: string }> {
  let last: string | undefined
  for (const part of loadedParts.size ? loadedParts : new Set(['persist:ws-default'])) { try { await session.fromPartition(part).loadExtension(dir) } catch (e) { last = String(e).replace(/^Error:\s*/, '').slice(0, 200) } }
  return last ? { ok: false, error: last } : { ok: true }
}
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

let favicons: FaviconStore, thumbs: ThumbStore, sites: SiteStore, passwords: PasswordService, notes: NoteStore, usage: UsageStore, widgets: WidgetService, perfHist: PerfHistory, ai: AiService
const notified: string[] = []
const focusServer = new FocusServer((a) => {
  if (a.kind === 'trust') { threat.trust(a.host); return }
  const f = settings.get().focus ?? { on: false, sites: [], limits: {} }
  if (a.kind === 'off') settings.set({ focus: { ...f, on: false } })
  else settings.set({ focus: { ...f, snooze: { ...(f.snooze ?? {}), [a.site]: Date.now() + a.minutes * 60_000 } } })
  pushSettings()
})
/** Pencere zemini: macOS'ta saydam + vibrancy (cam); Windows 11'de Mica; Windows 10/Linux'ta opak koyu (saydam zemin beyaza dusmesin) */
function windowChrome(): Partial<Electron.BrowserWindowConstructorOptions> {
  if (process.platform === 'darwin') return { backgroundColor: '#00000000' }
  if (process.platform === 'win32') return { backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0b' : '#f5f5f7', backgroundMaterial: 'mica' as const }
  return { backgroundColor: nativeTheme.shouldUseDarkColors ? '#0a0a0b' : '#f5f5f7' }
}
let updNotified = ''
let threat: ThreatService
/** zararli/taklit site uyari sayfasi; sorun yoksa (veya ozellik kapaliysa) null */
function threatBlock(url: string): string | null {
  if (!threat || !focusServer.ready || settings.get().safeBrowsing === false) return null
  const th = threat.check(url); if (!th) return null
  const key = th.kind === 'malware' ? 'threat.malware' : th.kind === 'idn' ? 'threat.idn' : 'threat.lookalike'
  return focusServer.warnUrlFor({ host: th.host, target: url, title: tr('threat.title'), msg: tr(key, { b: th.brand ?? '' }), back: tr('threat.back'), proceed: tr('threat.proceed') })
}
/** engelli adres icin engel sayfasi adresi; engelli degilse null */
function focusBlock(url: string): string | null {
  const t = threatBlock(url); if (t) return t
  const b = blockReason(url, settings?.get().focus, (s) => usage?.usedToday(s) ?? 0)
  if (!b || !focusServer.ready) return null
  const lim = settings.get().focus?.limits[b.site]
  return focusServer.urlFor({ site: b.site, reason: b.reason, limitMin: lim, target: url, s: { title: tr('focus.title'), focusMsg: tr('focus.msg'), limitMsg: tr('focus.limitMsg'), allow5: tr('focus.allow5'), allow30: tr('focus.allow30'), off: tr('focus.off'), back: tr('focus.back') } })
}
const pendingNotes = new Map<string, { tabId: string; cap?: { text: string; prefix: string; suffix: string }; noteId?: string }>()
let noteSeq = 0
/** Kayitli vurgulari sayfaya uygula (gizli sekmede yok; dinamik icerik icin ikinci deneme) */
async function applyNotes(wc: Electron.WebContents): Promise<void> {
  if (wc.isDestroyed() || tabs.isPrivateWc(wc)) return
  const list = notes?.forPage(wc.getURL()) ?? []; if (!list.length) return
  await wc.executeJavaScript(applyNotesScript(list)).catch(() => {})
  setTimeout(() => { if (!wc.isDestroyed()) void wc.executeJavaScript(applyNotesScript(list)).catch(() => {}) }, 1500)
}
const recorder = new Recorder((st) => send(Ch.recState, st))
const replayer = new Replayer()
const stateBridge = new StateBridge(bus)
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
    const target = e.winId !== here ? here : (tabs.normalWindowIds().find((x) => x !== here) ?? await openWindow())
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
  handle(Ch.pwList, null, () => ({ logins: passwords.list(), never: passwords.never(), available: process.env.DB_SCRIPT ? true : keychainCipher.available() }))
  handle(Ch.pwDelete, schemas.pwDelete, ({ origin, username }) => passwords.remove(origin, username))
  handle(Ch.pwCopy, schemas.pwDelete, ({ origin, username }) => passwords.copy(origin, username))
  handle(Ch.pwNeverRemove, schemas.pwNever, ({ origin }) => passwords.removeNever(origin))
  handle(Ch.pwAudit, schemas.pwAudit, ({ check }) => passwords.audit(check ? async (prefix) => {
    if (process.env.DB_PWNED_RANGE) return process.env.DB_PWNED_RANGE // testlerde ag yok
    const r = await net.fetch(`https://api.pwnedpasswords.com/range/${prefix}`, { headers: { 'Add-Padding': 'true' }, signal: AbortSignal.timeout(8000) })
    return r.ok ? r.text() : null
  } : null))
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
  handle(Ch.translate, schemas.translate, ({ id, off }) => tabs.translate(id, settings.get().language, off))
  // Sekme onizleme karti: sayfa gorunumlerinin USTUNDE duran kucuk bir WebContentsView (kabuk DOM'u native gorunumun altinda kalir)
  handle(Ch.tabCard, schemas.tabCard, ({ id, x, y, side }) => showTabCard(id, x, y, side ?? 'below'))
  // Recorder
  handle(Ch.recStart, null, async () => { const e = tabs.active(); return e ? recorder.start(e.view.webContents, e.info.id) : false })
  handle(Ch.recStop, null, async () => { const a = recorder.active(); const e = a && tabs.get(a.tabId); return e ? recorder.stop(e.view.webContents) : [] })
  handle(Ch.recReplay, schemas.recReplay, async ({ steps, timeoutMs }) => {
    const e = tabs.active(); if (!e) return { ok: 0, fail: 0, skipped: 0, error: 'no tab' }
    return replayer.run(e.view.webContents, steps as never, (i, state, err) => send(Ch.recReplayState, { i, state, err }), timeoutMs ?? 5000)
  })
  handle(Ch.recReplayStop, null, () => replayer.cancel())
  handle(Ch.recSave, schemas.recSave, async ({ code, name }) => {
    const base = (name || 'recorded-flow').replace(/[^\w\-]+/g, '_').slice(0, 60) || 'recorded-flow'
    let file: string | undefined
    if (process.env.DB_OUT_DIR) file = join(process.env.DB_OUT_DIR, `${base}.spec.ts`)
    else { const r = await dialog.showSaveDialog(curWin ?? win, { defaultPath: join(app.getPath('documents'), `${base}.spec.ts`), filters: [{ name: 'Playwright', extensions: ['ts'] }] }); file = r.canceled ? undefined : r.filePath }
    if (!file) return null
    writeFileSync(file, code); return file
  })
  // Bellek (heap) anlik goruntusu: Chrome DevTools > Memory'de acilabilen .heapsnapshot dosyasi (Downloads'a)
  handle(Ch.heapSnap, null, async () => {
    const e = tabs.active(); if (!e) return null
    const wc = e.view.webContents, chunks: string[] = []
    const onMsg = (_e: unknown, m: string, p: { chunk?: string }): void => { if (m === 'HeapProfiler.addHeapSnapshotChunk' && typeof p.chunk === 'string') chunks.push(p.chunk) }
    wc.debugger.on('message', onMsg)
    try {
      await wc.debugger.sendCommand('HeapProfiler.enable')
      await wc.debugger.sendCommand('HeapProfiler.collectGarbage').catch(() => {})
      await wc.debugger.sendCommand('HeapProfiler.takeHeapSnapshot', { reportProgress: false, treatGlobalObjectsAsRoots: true })
    } catch { return null } finally { wc.debugger.removeListener('message', onMsg); void wc.debugger.sendCommand('HeapProfiler.disable').catch(() => {}) }
    const data = chunks.join(''); if (!data.startsWith('{')) return null
    const dir = process.env.DB_OUT_DIR || app.getPath('downloads'); mkdirSync(dir, { recursive: true })
    const host = (() => { try { return new URL(wc.getURL()).hostname } catch { return 'page' } })()
    const file = join(dir, `${host}-${Date.now()}.heapsnapshot`)
    writeFileSync(file, data)
    return { file, mb: Math.round((data.length / 1048576) * 10) / 10 }
  })
  // Yerel ag adresi: localhost dev sunucusunu telefonda acmak icin (sunucu 0.0.0.0'a baglanmissa erisilebilir)
  handle(Ch.lanInfo, schemas.lanInfo, async ({ id }) => {
    const e = tabs.get(id); if (!e) return null
    const ip = process.env.DB_LAN_IP || pickLanIp(networkInterfaces() as never); if (!ip) return null
    const url = lanUrl(e.view.webContents.getURL(), ip); if (!url) return null
    const reachable = await net.fetch(url, { signal: AbortSignal.timeout(1500), method: 'HEAD' }).then(() => true, () => false)
    return { url, ip, reachable }
  })
  // Tum sekmelerde ara: her (uyumayan) sekmenin metni CDP'siz, executeJavaScript ile (1.5 sn sinir); uyuyanlar yalniz baslik/adres
  handle(Ch.tabsSearch, schemas.tabsSearch, async ({ q }) => {
    const infos = tabs.list().tabs.filter((t) => t.workspaceId === activeWorkspaceId)
    const hits = await Promise.all(infos.map(async (t): Promise<TabHit> => {
      const base: TabHit = { id: t.id, title: t.title, url: t.url, count: 0, snippets: [], titleMatch: matchesTitle(t.title, t.url, q), ...(t.sleeping ? { sleeping: true } : {}), ...(t.private ? { private: true } : {}) }
      const wc = tabs.get(t.id)?.view.webContents
      if (!q.trim() || t.sleeping || !wc || wc.isDestroyed() || !/^https?:/.test(t.url)) return base
      const text = await Promise.race([wc.executeJavaScript('document.body ? document.body.innerText.slice(0, 2000000) : ""'), new Promise<string>((r) => setTimeout(() => r(''), 1500))]).catch(() => '')
      return { ...base, ...searchText(String(text), q) }
    }))
    return rankTabs(hits.filter((h) => !q.trim() || h.count > 0 || h.titleMatch))
  })
  // Sesli okuma: secili metin, yoksa okuyucu makalesi, yoksa sayfanin ana metni
  handle(Ch.speak, schemas.speak, async ({ mode }) => { const e = tabs.active(); return speakFrom(e?.view.webContents ?? null, mode) })
  // Sayfa notlari / vurgulari
  handle(Ch.noteList, null, () => notes.all())
  handle(Ch.noteSave, schemas.noteSave, ({ tempId, note }) => {
    const p = pendingNotes.get(tempId); pendingNotes.delete(tempId); if (!p) return false
    const e = tabs.get(p.tabId); const wc = e?.view.webContents; if (!wc || wc.isDestroyed()) return false
    if (p.noteId) { const n = notes.update(p.noteId, { note }); if (n) { void wc.executeJavaScript(removeNoteScript(n.id)).then(() => applyNotes(wc)).catch(() => {}) } return !!n }
    if (!p.cap) return false
    const n = notes.add(wc.getURL(), p.cap, note); if (n) void applyNotes(wc); return !!n
  })
  handle(Ch.noteDelete, schemas.noteDelete, ({ id }) => {
    const n = notes.remove(id); if (!n) return false
    tabs.each((wc) => { if (pageKey(wc.getURL()) === n.url) void wc.executeJavaScript(removeNoteScript(id)).catch(() => {}) }); return true
  })
  handle(Ch.syncState, null, () => ({ enabled: syncSt.enabled, hasPass: !!syncSt.pass, last: syncSt.last, error: syncSt.error, dir: syncSvc.dir(), icloud: syncSvc.available(), custom: !!settings.get().syncDir }))
  handle(Ch.syncPickDir, schemas.syncPickDir, async ({ reset }) => {
    if (reset) { settings.set({ syncDir: '' }); pushSettings(); return '' }
    const dir = process.env.DB_SYNC_PICK ?? (await dialog.showOpenDialog(curWin ?? win, { properties: ['openDirectory', 'createDirectory'], title: tr('set.syncPick') })).filePaths[0]
    if (!dir) return settings.get().syncDir ?? ''
    settings.set({ syncDir: dir }); pushSettings(); return dir
  })
  handle(Ch.syncSetup, schemas.syncSetup, (p) => { if (p.clear) syncSt = { enabled: false, last: 0, error: '', pass: '' }; if (p.pass) syncSt.pass = syncCipher().encrypt(p.pass); if (p.enabled !== undefined) syncSt.enabled = p.enabled; saveSyncSt(); return true })
  handle(Ch.syncNow, null, () => runSync())
  handle(Ch.hubOpen, schemas.hubOpen, async ({ id, background, external }) => {
    if (external) { const svc = serviceById(id), url = svc && serviceUrl(svc, hubCfg()); if (!url || !/^https:/.test(url)) return 'no-url'; await shell.openExternal(url); return 'ok' }
    return hubOpen(id, !!background)
  })
  handle(Ch.hubNext, null, async () => {
    const cur = tabs.active()?.info.service
    const items = tabs.list().tabs.filter((t) => t.service).map((t) => ({ id: t.service!, unread: t.unread ?? 0 }))
    const id = nextUnread(items, cur); if (id) await hubOpen(id); return id
  })
  handle(Ch.updateInfo, schemas.updateInfo, async ({ check }) => (check || !updateInfo().checked ? checkUpdate() : updateInfo()))
  handle(Ch.extList, null, () => { const out: { id: string; name: string; version: string; path: string }[] = []; for (const part of new Set(['persist:ws-default', ...workspaces.list().map((w) => partitionFor(w.id))])) for (const e of session.fromPartition(part).getAllExtensions()) if (!out.some((o) => o.id === e.id)) out.push({ id: e.id, name: e.name, version: e.version, path: e.path }); return out })
  handle(Ch.extAdd, null, async () => {
    const dir = process.env.DB_EXT_DIR ?? (await dialog.showOpenDialog(curWin ?? win, { properties: ['openDirectory'], title: tr('set.extPick') })).filePaths[0]
    if (!dir) return { ok: false }
    const r = await loadExtensionAll(dir); if (!r.ok) return r
    const cur = settings.get().extensions ?? []; if (!cur.includes(dir)) settings.set({ extensions: [...cur, dir] }); pushSettings(); return { ok: true }
  })
  handle(Ch.extRemove, schemas.extRemove, async ({ path }) => {
    for (const part of loadedParts) for (const e of session.fromPartition(part).getAllExtensions()) if (e.path === path) await session.fromPartition(part).removeExtension(e.id)
    settings.set({ extensions: (settings.get().extensions ?? []).filter((x) => x !== path) }); pushSettings(); return true
  })
  handle(Ch.appOpen, schemas.appOpen, ({ url }) => openAppWindow(url ?? tabs.active()?.info.url ?? ''))
  handle(Ch.usageGet, schemas.usageGet, ({ days }) => { const ds = lastDays(days); return { days: ds, usage: Object.fromEntries(ds.map((d) => [d, usage.all()[d] ?? {}])) } })
  // Baslangic sayfasi parcalari
  handle(Ch.wRates, null, () => (settings.get().widgets?.currency ? widgets.rates() : []))
  handle(Ch.wWeather, schemas.wWeather, ({ city }) => widgets.weather(city))
  handle(Ch.remList, null, () => widgets.reminders())
  handle(Ch.remAdd, schemas.remAdd, ({ input }) => { const p = parseReminder(input); if (!p) return false; widgets.add(p.text, p.due); return true })
  handle(Ch.remDelete, schemas.remDelete, ({ id }) => widgets.remove(id))
  handle(Ch.perfSave, schemas.perfSave, ({ key, m }) => perfHist.add(key, m))
  handle(Ch.perfHistory, schemas.perfHistory, ({ key }) => perfHist.list(key))
  // Disa aktarilan metin dosyalari (MSW/Postman/OpenAPI): Downloads'a, ad temizlenir
  handle(Ch.exportSave, schemas.exportSave, ({ name, content }) => {
    const dir = process.env.DB_OUT_DIR || app.getPath('downloads'); mkdirSync(dir, { recursive: true })
    const file = uniquePath(dir, name.replace(/[\\/:*?"<>|\0]+/g, '_'))
    writeFileSync(file, content); if (!process.env.DB_SCRIPT) shell.showItemInFolder(file)
    return file
  })
  // AI ile acikla: once ONIZLEME (gonderilecek metin + hedef), kullanici onaylayinca istek
  handle(Ch.aiPreview, schemas.aiPreview, ({ focusId }) => {
    const e = tabs.active(); const cfg = (settings.get().ai ?? { provider: 'ollama', model: 'llama3.1' }) as AiConfig
    const prompt = e ? buildAiContext(bus.snapshot(e.info.id), e.view.webContents.getURL(), focusId) : ''
    const target = cfg.provider === 'ollama' ? (cfg.endpoint || 'http://127.0.0.1:11434') : cfg.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com'
    return { prompt, provider: cfg.provider, model: cfg.model, target, needsKey: needsKey(cfg.provider), hasKey: ai.hasKey(cfg.provider), empty: !/ERROR:|CONSOLE|REQUEST FAILED/.test(prompt) }
  })
  handle(Ch.aiAsk, schemas.aiAsk, ({ prompt }) => ai.ask(prompt, settings.get().language))
  handle(Ch.aiKey, schemas.aiKey, ({ provider, key }) => ({ saved: ai.setKey(provider, key), hasKey: ai.hasKey(provider) }))
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
  handle(Ch.downloadAct, schemas.downloadAct, ({ id, act }) => {
    switch (act) { case 'pause': return downloads.pause(id); case 'resume': return downloads.resume(id); case 'cancel': return downloads.cancel(id)
      case 'open': downloads.open(id); return true; case 'show': downloads.show(id); return true; case 'remove': return downloads.remove(id); case 'clear': return downloads.clearDone() > 0 }
  })
  handle(Ch.downloadShow, schemas.downloadShow, ({ id }) => downloads.show(id))
  handle(Ch.settingsGet, null, () => settings.get())
  handle(Ch.settingsSet, schemas.settingsSet, (p) => { const before = settings.get().language; settings.set(p); if (p.adblock !== undefined || p.adblockAllow !== undefined) tabs.refreshRules(); if (p.spellcheck !== undefined) tabs.each((wc) => wc.session.setSpellCheckerEnabled(p.spellcheck!)); if (p.ambient !== undefined) tabs.each((wc) => void wc.executeJavaScript(`window.__dbAmbient&&(window.__dbAmbient.on=${p.ambient})`).catch(() => {})); if (p.theme) applyTheme(p.theme); if (p.language && p.language !== before) installMenu((cmd) => sendFocused(Ch.cmd, cmd), settings.get().language); pushSettings(); return settings.get() })
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
  handle(Ch.sourceOpen, schemas.sourceOpen, ({ file, line, column, editor }) => openInEditor(file, line, column ?? 1, editor ?? 'vscode'))
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
/** macOS sistem izni (TCC): kamera/mikrofon icin once sistemden iste; reddedilmisse Sistem Ayarlari'ni ac. Test modunda atlanir. */
async function ensureSystemMedia(kinds: ('camera' | 'microphone')[]): Promise<boolean> {
  if (process.platform !== 'darwin' || process.env.DB_SCRIPT) return true
  for (const k of kinds) {
    let st = systemPreferences.getMediaAccessStatus(k)
    if (st === 'not-determined') st = (await systemPreferences.askForMediaAccess(k).catch(() => false)) ? 'granted' : 'denied'
    if (st !== 'granted') {
      const r = await dialog.showMessageBox(curWin ?? win, { type: 'info', buttons: [tr('perm.openSettings'), tr('dlg.cancel')], defaultId: 0, cancelId: 1, message: tr(k === 'camera' ? 'perm.sysCamera' : 'perm.sysMic'), detail: tr('perm.sysDetail') })
      if (r.response === 0) void shell.openExternal(`x-apple.systempreferences:com.apple.preference_security?Privacy_${k === 'camera' ? 'Camera' : 'Microphone'}`)
      return false
    }
  }
  return true
}
const permissionHandlers = {
  check: (wc: Electron.WebContents | null, permission: string, origin: string, details: any): boolean => {
    if (permission === 'notifications' && tabs.serviceOfWc(wc)) return true // Hub servisleri: bildirim sormadan acik
    if (permission === 'geolocation' && wc && tabs.isGeoEmulated(wc)) return true
    const key = permissionKey(permission, details)
    if (key === 'auto') return true
    const o = originOf(origin) || originOf(wc?.getURL() ?? '')
    // mediaType 'unknown' (aygit listeleme): kamera veya mikrofondan biri izinliyse etiketler gorunsun
    if (permission === 'media' && !details?.mediaType?.match(/^(video|audio)$/)) return perms.get(o, 'camera') === 'allow' || perms.get(o, 'microphone') === 'allow'
    if (!key) return false
    return perms.get(o, key) === 'allow'
  },
  request: async (wc: Electron.WebContents | null, permission: string, details: any): Promise<boolean> => {
    if (permission === 'notifications' && tabs.serviceOfWc(wc)) return true
    if (permission === 'geolocation' && wc && tabs.isGeoEmulated(wc)) return true
    const key = permissionKey(permission, details)
    if (key === 'auto') return true
    const origin = originOf(details?.requestingUrl ?? wc?.getURL() ?? '')
    if (!key || !origin) return false
    const kinds = permission === 'media' ? ((details?.mediaTypes ?? []) as string[]).flatMap((t) => (t === 'video' ? ['camera' as const] : t === 'audio' ? ['microphone' as const] : [])) : []
    // kamera+mikrofon birlikte istenebilir (Meet/Zoom): ikisi tek kutuda sorulur, karar ikisine birden kaydedilir
    const keys: PermKey[] = kinds.length ? kinds : [key as PermKey]
    const states = keys.map((k) => perms.get(origin, k))
    if (states.some((x) => x === 'deny')) return false
    if (states.every((x) => x === 'allow')) return kinds.length ? ensureSystemMedia(kinds) : true
    const label = keys.length > 1 ? 'camera+microphone' : keys[0]
    const id = `perm-${++permSeq}`
    // yalniz istegi yapan sekmenin penceresine goster (birden cok pencerede yinelenmesin)
    const wid = tabs.winOfWc(wc), target = wid !== undefined ? shellWins.get(wid) : undefined
    const msg = { id, origin, permission: label }
    if (target && !target.isDestroyed()) target.webContents.send(Ch.permAsk, msg); else send(Ch.permAsk, msg)
    return new Promise<boolean>((resolve) => {
      pendingPerms.set(id, (a) => {
        if (a === 'dismiss') { resolve(false); return }
        if (a === 'allow') for (const k of keys) perms.set(origin, k, 'allow')
        if (a === 'block') { for (const k of keys) perms.set(origin, k, 'deny'); resolve(false); return }
        if (kinds.length) void ensureSystemMedia(kinds).then(resolve); else resolve(true)
      })
      setTimeout(() => { if (pendingPerms.delete(id)) { send(Ch.permClose, { id }); resolve(false) } }, 30_000)
    })
  }
}

const cardViews = new Map<number, WebContentsView>()
const cardState = { shown: false, hasImg: false, bounds: { x: 0, y: 0, width: 0, height: 0 }, title: '' }
const escHtml = (s: string): string => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
function showTabCard(id: string | null, x: number, y: number, side: 'below' | 'right'): void {
  const w = curWin ?? win
  let v = cardViews.get(w.id)
  if (!id) { if (v && cardState.shown) { try { w.contentView.removeChildView(v) } catch { /* yok */ } } cardState.shown = false; return }
  const e = tabs.get(id); if (!e) return
  if (!v) { v = new WebContentsView({ webPreferences: { sandbox: true, contextIsolation: true, nodeIntegration: false } }); v.setBackgroundColor('#00000000'); cardViews.set(w.id, v) }
  const info = e.info, priv = !!info.private
  const thumb = priv || !info.url ? null : thumbs.get(info.url)
  const host = (() => { try { return new URL(info.url).host } catch { return '' } })()
  const title = priv ? tr('tab.private') : (!info.title || info.title === 'New Tab' ? tr('tab.untitled') : info.title)
  const W = 300, H = thumb ? 232 : 84
  const html = `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent;font:13px -apple-system,system-ui,sans-serif;color:#eee;-webkit-user-select:none}
.c{position:absolute;inset:8px;border-radius:12px;background:rgba(26,26,30,.97);border:1px solid rgba(255,255,255,.14);box-shadow:0 12px 34px rgba(0,0,0,.5);overflow:hidden}
.t{padding:10px 12px 2px;font-weight:600;line-height:1.3;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
.h{padding:0 12px 10px;color:#999;font:11.5px ui-monospace,Menlo,monospace;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
img{display:block;width:100%;border-top:1px solid rgba(255,255,255,.08)}</style><div class="c"><div class="t">${escHtml(title)}</div><div class="h">${escHtml(priv ? '' : host)}${info.sleeping ? ' · ' + escHtml(tr('tab.sleepingNote')) : ''}</div>${thumb ? `<img src="${thumb}">` : ''}</div>`
  void v.webContents.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  const [cw] = w.getContentSize()
  const bx = Math.max(0, Math.min(cw - W, side === 'right' ? x + 4 : x - 8)), by = side === 'right' ? y - 8 : y - 2
  v.setBounds({ x: Math.round(bx), y: Math.round(by), width: W, height: H })
  w.contentView.addChildView(v) // en uste
  Object.assign(cardState, { shown: true, hasImg: !!thumb, bounds: v.getBounds(), title })
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
async function showCtx(tabId: string, p: Electron.ContextMenuParams, dry = false): Promise<{ items: CtxItem[]; run: (it: CtxItem) => Promise<void> } | void> {
  const e = tabs.get(tabId); if (!e) return
  const wc = e.view.webContents, owner = shellWins.get(e.winId) ?? win
  const engine = engineById(settings.get().searchEngine)
  const url0 = wc.getURL()
  // sayfa baglami: sagtiklanan ogenin React bileseni, proje klasoru, yuklu tarayicilar
  const probe = /^https?:/.test(url0) ? await probeAt(wc, p.x, p.y) : null
  const root = e.cdp?.resolver.rootProvider?.() ?? workspaces.get(e.info.workspaceId)?.rootDir ?? null
  const editorLabel = EDITOR_LABEL[settings.get().editor ?? 'vscode'] ?? 'VS Code'
  const items = buildCtxMenu({ ...p, pageURL: url0, canGoBack: wc.navigationHistory.canGoBack(), canGoForward: wc.navigationHistory.canGoForward(), editFlags: p.editFlags,
    extra: { component: probe?.comp?.name, editorLabel, hasRoot: !!root, chrome: existsSync('/Applications/Google Chrome.app'), windows: tabs.normalWindowIds().length, hasSelector: !!probe?.sel, clickable: probe?.clickable, href: probe?.href, noteId: probe?.noteId } })
  const open = (url: string, priv?: 'incognito' | 'tor'): void => { void tabs.create({ url, workspaceId: e.info.workspaceId, winId: e.winId, ...((priv ?? e.info.private) ? { private: priv ?? e.info.private } : {}) }) }
  const run = async (it: CtxItem): Promise<void> => {
    const a = it.arg ?? ''
    switch (it.act) {
      case 'newTab': open('', undefined); break
      case 'newWindow': void openWindow(); break
      case 'linkSplit': void tabs.create({ url: a, workspaceId: e.info.workspaceId, winId: e.winId, activate: false, ...(e.info.private ? { private: e.info.private } : {}) }).then((nid) => { tabs.inWin(e.winId, () => tabs.setSplit(nid)) }); break
      case 'linkOtherWin': void openInNewWindow(a, e.info.workspaceId, e.winId, e.info.private); break
      case 'component': {
        const c = probe?.comp; if (!c) break
        const resolver = e.cdp?.resolver; let loc: { file: string; line: number; column: number } | null = null
        if (resolver && c.t !== undefined) loc = c.src ? resolver.setPrecise(c.t, c.name, c.src) : await resolver.resolveType(c.t, c.name).catch(() => null)
        const ok = loc ? await openInEditor(loc.file, loc.line, loc.column, settings.get().editor ?? 'vscode') : false
        if (!ok && root) await openInEditor0(root) // kaynak cozulemediyse proje klasorunu ac
        break
      }
      case 'openRoot': if (root) await openInEditor0(root); break
      case 'inspectEl': {
        owner.webContents.send(Ch.cmd, 'inspect.elements'); await new Promise((r) => setTimeout(r, 600))
        if (probe?.backendNodeId !== undefined) send(Ch.dtEvent, { id: tabId, method: 'Overlay.inspectNodeRequested', params: { backendNodeId: probe.backendNodeId } })
        break
      }
      case 'copySel': if (probe?.sel) clipboard.writeText(probe.sel); break
      case 'lab': void tabs.setLab(tabId, ['iphone-se', 'iphone-15', 'ipad-mini']); break
      case 'shotView': case 'shotFull': { const png = await captureShot(wc, it.act === 'shotFull' ? 'full' : 'viewport'); if (png) { mkdirSync(app.getPath('downloads'), { recursive: true }); const f = uniquePath(app.getPath('downloads'), shotName(url0)); writeFileSync(f, png); if (!process.env.DB_SCRIPT) shell.showItemInFolder(f); lastShot = f } break }
      case 'openApp': void openAppWindow(url0); break
      case 'openChrome': execFile('open', ['-a', 'Google Chrome', url0]); break
      case 'openSafari': execFile('open', ['-a', 'Safari', url0]); break
      case 'back': wc.navigationHistory.goBack(); break
      case 'forward': wc.navigationHistory.goForward(); break
      case 'reload': wc.reload(); break
      case 'btnNewTab': case 'btnNewWindow': {
        tabs.divertNext(tabId, it.act === 'btnNewTab' ? 'tab' : 'window')
        wc.sendInputEvent({ type: 'mouseDown', x: p.x, y: p.y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x: p.x, y: p.y, button: 'left', clickCount: 1 })
        break
      }
      case 'linkNewWindow': void openInNewWindow(a, e.info.workspaceId, e.winId, e.info.private); break
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
      case 'highlight': case 'addNote': {
        if (e.info.private) break
        const cap = await wc.executeJavaScript(CAPTURE_SELECTION).catch(() => null) as { text: string; prefix: string; suffix: string } | null
        if (!cap) break
        if (it.act === 'highlight') { const n = notes.add(url0, cap); if (n) void applyNotes(wc) }
        else { const tempId = `pn${++noteSeq}`; pendingNotes.set(tempId, { tabId, cap }); owner.webContents.send(Ch.noteAsk, { tempId, text: cap.text, existing: '' }) }
        break
      }
      case 'editNote': { const n = notes.get(a); if (n) { const tempId = `pn${++noteSeq}`; pendingNotes.set(tempId, { tabId, noteId: n.id }); owner.webContents.send(Ch.noteAsk, { tempId, text: n.text, existing: n.note ?? '' }) } break }
      case 'removeNote': { const n = notes.remove(a); if (n) void wc.executeJavaScript(removeNoteScript(n.id)).catch(() => {}); break }
      case 'speakSel': void speakFrom(wc, 'selection'); break
      case 'speakPage': void speakFrom(wc, 'page'); break
      case 'savePage': void pageOutput(wc, 'save'); break
      case 'print': void pageOutput(wc, 'print'); break
      case 'savePdf': void pageOutput(wc, 'pdf'); break
      case 'translate': tabs.translate(tabId, settings.get().language); break
      case 'qr': owner.webContents.send(Ch.cmd, 'qr.open'); break
      case 'inspect': wc.inspectElement(p.x, p.y); break
      case 'viewSource': {
        const raw = await net.fetch(wc.getURL(), { signal: AbortSignal.timeout(8000) }).then((r) => r.text()).catch(() => '')
        const body = raw || await wc.executeJavaScript('document.documentElement.outerHTML').catch(() => '')
        open(await viewSourceServer.url({ status: 200, body: String(body).slice(0, 3_000_000), contentType: 'text/plain; charset=utf-8' })); break
      }
    }
  }
  const label = (it: CtxItem): string => it.label === 'cm.dev' ? tr('cm.dev') : it.act === 'component' ? tr('cm.component', { name: it.vars?.name ?? '', editor: it.vars?.editor ?? '' }) : it.act === 'openRoot' ? tr('cm.openRoot', { editor: it.vars?.editor ?? '' }) : it.act === 'suggest' ? (it.arg ?? '') : it.act === 'addWord' ? tr('cm.addWord') : it.act === 'search' ? tr('cm.search', { engine: engine.label, q: (it.arg ?? '').slice(0, 30) }) : tr((it.label ?? `cm.${it.act}`) as Key)
  const conv = (list: CtxItem[]): Electron.MenuItemConstructorOptions[] => list.map((it) => (it.sep ? { type: 'separator' as const } : it.submenu ? { label: label(it), submenu: conv(it.submenu) } : { label: label(it), enabled: it.enabled !== false, click: () => void run(it) }))
  if (dry) return { items, run } // testler: native menu acmadan maddeleri ve eylemleri dogrudan dene
  const tpl = conv(items)
  Menu.buildFromTemplate(tpl).popup({ window: owner })
}

/** Dosya yolu sayfanin source map'inden / derleme eklentisinden gelir (guvenilmez): yalnizca bilinen VE guvenilir bir kokun
 *  (Workspace klasoru, dev sunucusunun proje klasoru, demo) altindaki dosyalar editorde acilir. */
async function openInEditor(file: string, line: number, column: number, editor: Editor): Promise<boolean> {
  let root: string | null = null
  const known = tabs.list().tabs.some((t) => {
    const e = tabs.get(t.id)
    if (!e?.cdp?.resolver.knownFiles.has(file)) return false
    const roots = [workspaces.get(e.info.workspaceId)?.rootDir, e.cdp.resolver.rootProvider?.(), join(samplesDir, 'demo-src')]
    if (!isInsideAny(roots, file)) return false
    root = roots.find((r): r is string => !!r && isInsideAny([r], file)) ?? null
    return true
  })
  if (!known) return false
  await launchEditor(editor, { file, line, column, root }) // proje klasoru yeni pencerede, dosya o satirda
  return true
}
let lastEditorOpen: { file: string; line: number; column: number; editor: string; args?: string[] } | null = null
const EDITOR_LABEL: Record<string, string> = { vscode: 'VS Code', cursor: 'Cursor', webstorm: 'WebStorm' }

/** Ekran paylasimi (getDisplayMedia: Meet/Zoom/Teams): kendi kaynak menumuz (macOS sistem secicisi SCContentSharingPicker secim aninda yerel istisnayla uygulamayi dusuruyordu: kapali). Test modunda DB_DISPLAY_PICK=none ile reddedilir. */
let displayRequests = 0
function handleDisplayMedia(ses: Electron.Session): void {
  ses.setDisplayMediaRequestHandler((_request, callback) => {
    displayRequests++
    if (process.env.DB_SCRIPT) { callback({} as Electron.Streams); return }
    void desktopCapturer.getSources({ types: ['screen', 'window'], thumbnailSize: { width: 0, height: 0 } }).then((sources) => {
      if (!sources.length) { callback({} as Electron.Streams); return }
      // Birden cok ekranda imlecin bulundugu ekran otomatik paylasilir (menu yok); tek ekranda kaynak menusu cikar
      const under = screenAtPoint(sources.map((x) => ({ id: x.id, name: x.name, display_id: x.display_id })), screen.getAllDisplays(), screen.getCursorScreenPoint())
      if (under && screen.getAllDisplays().length > 1) { const src = sources.find((x) => x.id === under.id); if (src) { callback({ video: src }); return } }
      let done = false
      const items: Electron.MenuItemConstructorOptions[] = sources.slice(0, 30).map((s) => ({ label: (s.id.startsWith('screen') ? '🖥 ' : '') + (s.name || s.id).slice(0, 70), click: () => { done = true; callback({ video: s }) } }))
      Menu.buildFromTemplate([{ label: tr('share.pick'), enabled: false }, { type: 'separator' }, ...items]).popup({ window: BrowserWindow.getFocusedWindow() ?? win, callback: () => { if (!done) callback({} as Electron.Streams) } })
    }).catch(() => callback({} as Electron.Streams))
  }, { useSystemPicker: false })
}

const speaker = new Speaker((on) => send(Ch.speakState, on))
let lastSpeak: { text: string; lang: string } | null = null
const SPEAK_SCRIPT = (mode: string): string => `(() => {
  const sel = (window.getSelection() || '').toString().trim()
  if (${mode === 'page' ? 'false' : 'true'} && sel) return sel
  if (${mode === 'selection' ? 'true' : 'false'}) return ''
  const r = document.querySelector('.db-reader'); if (r) return r.innerText
  const m = document.querySelector('article, main, [role=main]'); return (m || document.body).innerText.slice(0, 40000)
})()`
async function speakFrom(wc: Electron.WebContents | null, mode: 'auto' | 'selection' | 'page' | 'stop'): Promise<boolean> {
  if (mode === 'stop') { speaker.stop(); return false }
  if (!wc || wc.isDestroyed() || !/^https?:/.test(wc.getURL())) return false
  const text = String(await wc.executeJavaScript(SPEAK_SCRIPT(mode)).catch(() => '') ?? '')
  const lang = String(await wc.executeJavaScript('(document.documentElement.lang||"").slice(0,2)').catch(() => '')) || settings.get().language
  if (process.env.DB_SCRIPT) { lastSpeak = { text: text.replace(/\s+/g, ' ').trim().slice(0, 4000), lang }; return !!text.trim() } // testlerde ses calinmaz
  return !!(await speaker.speak(text, lang))
}

/** Siteyi uygulama olarak ac: sekmesiz sade pencere. Ayni site zaten aciksa o pencere one gelir. */
async function openAppWindow(url: string): Promise<boolean> {
  let site = ''; try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return false; site = siteOf(u.hostname) } catch { return false }
  const open = tabs.list().tabs.find((t) => t.app && (() => { try { return siteOf(new URL(t.url).hostname) === site } catch { return false } })())
  if (open) { tabs.activate(open.id); return true }
  const id = await openWindow({ app: true })
  await tabs.create({ url, workspaceId: activeWorkspaceId, winId: id })
  return true
}

/** URL'yi baska bir pencerede ac (yalniz bir pencere varsa ikincisini acar) */
async function openInNewWindow(url: string, workspaceId: string, fromWin: number, priv?: 'incognito' | 'tor'): Promise<void> {
  const other = tabs.normalWindowIds().find((w) => w !== fromWin) ?? await openWindow()
  void tabs.create({ url, workspaceId, winId: other, ...(priv ? { private: priv } : {}) })
}
/** Editoru YENI pencerede ac (CLI + -n): acik editor pencerelerine/oturumlarina dokunmaz; CLI yoksa URL semasina duser */
async function launchEditor(editor: Editor, t: { file?: string; line?: number; column?: number; root?: string | null }): Promise<void> {
  const cmd = editorCommand(editor, t)
  if (process.env.DB_SCRIPT) { lastEditorOpen = { file: t.file ?? t.root ?? '', line: t.line ?? 1, column: t.column ?? 1, editor, args: cmd.args }; return }
  const bin = cmd.bins.find((b) => existsSync(b))
  if (bin) { execFile(bin, cmd.args, () => {}).unref(); return }
  await shell.openExternal(editorUrl(editor, t.file ?? t.root ?? '', t.line ?? 1, t.column ?? 1))
}

/** Klasoru editorde ac (yalnizca kendi tespit ettigimiz proje/Workspace klasoru) */
async function openInEditor0(dir: string): Promise<void> {
  await launchEditor(settings.get().editor ?? 'vscode', { root: dir })
}
let lastShot: string | null = null

/** Sag tik noktasindaki oge: en yakin React bileseni (+ kaynak) ve CSS secici. DOM/Runtime CDP uzerinden; 300 ms'de donmezse yok sayilir. */
const CTX_PROBE_FN = `function () {
  const el = this.nodeType === 1 ? this : this.parentElement; if (!el) return null
  const comp = window.__IZLIX_INDEX_OF__ ? window.__IZLIX_INDEX_OF__(el) : null
  const esc = (s) => (window.CSS && CSS.escape ? CSS.escape(s) : s)
  let sel = ''
  if (el.id) sel = '#' + esc(el.id)
  else { const parts = []; for (let n = el, i = 0; n && n.nodeType === 1 && i < 5 && n !== document.documentElement; n = n.parentElement, i++) { let s = n.tagName.toLowerCase(); if (n.id) { parts.unshift('#' + esc(n.id)); break } const p = n.parentElement; if (p) { const same = [...p.children].filter((c) => c.tagName === n.tagName); if (same.length > 1) s += ':nth-of-type(' + (same.indexOf(n) + 1) + ')' } parts.unshift(s) } sel = parts.join(' > ') }
  const cl = el.closest ? el.closest('button,[role=button],[role=link],[role=tab],[role=menuitem],summary,input[type=button],input[type=submit],[onclick],[data-href],[data-url],[data-link]') : null
  const clickable = !!cl || getComputedStyle(el).cursor === 'pointer'
  let href = ''
  const abs = (v) => { try { const u = new URL(v, location.href); return /^https?:$/.test(u.protocol) ? u.href : '' } catch (e) { return '' } }
  const host = cl || el
  const fa = host.getAttribute && host.getAttribute('formaction'); if (fa) href = abs(fa)
  if (!href && host.closest) { const h = host.closest('[data-href],[data-url],[data-link]'); if (h) href = abs(h.getAttribute('data-href') || h.getAttribute('data-url') || h.getAttribute('data-link') || '') }
  if (!href && host.getAttribute) { const oc = host.getAttribute('onclick') || ''; const m = /(?:location(?:\\.href)?\\s*=|location\\.assign\\(|window\\.open\\()\\s*['"]([^'"]+)['"]/.exec(oc); if (m) href = abs(m[1]) }
  if (!href && host.closest) { const f = host.closest('form'); if (f && host.tagName === 'BUTTON' && (host.type || 'submit') === 'submit' && f.action && abs(f.action) !== location.href) href = abs(f.action) }
  const nm = el.closest ? el.closest('mark[data-db-note]') : null
  return { comp: comp, sel: sel, clickable: clickable, href: href, noteId: nm ? nm.getAttribute('data-db-note') : '' }
}`
interface Probe { noteId?: string; comp?: { id: number; name: string; t?: number; src?: string }; sel?: string; clickable?: boolean; href?: string; backendNodeId?: number }
async function probeAt(wc: Electron.WebContents, x: number, y: number): Promise<Probe | null> {
  const run = async (): Promise<Probe | null> => {
    const loc: any = await wc.debugger.sendCommand('DOM.getNodeForLocation', { x: Math.round(x), y: Math.round(y), includeUserAgentShadowDOM: false })
    const r: any = await wc.debugger.sendCommand('DOM.resolveNode', { backendNodeId: loc.backendNodeId })
    const objectId = r.object?.objectId; if (!objectId) return null
    const res: any = await wc.debugger.sendCommand('Runtime.callFunctionOn', { objectId, returnByValue: true, functionDeclaration: CTX_PROBE_FN })
    void wc.debugger.sendCommand('Runtime.releaseObject', { objectId }).catch(() => {})
    const v = res.result?.value; return v ? { comp: v.comp ?? undefined, sel: v.sel || undefined, clickable: !!v.clickable, href: v.href || undefined, noteId: v.noteId || undefined, backendNodeId: loc.backendNodeId } : null
  }
  try { return await Promise.race([run(), new Promise<null>((r) => setTimeout(() => r(null), 300))]) } catch { return null }
}

/** Kabuk penceresi kapaniyorsa sekmeleri kalan pencereye tasir (uygulama kapanirken oturum bozulmasin diye atlanir) */
function onShellClose(w: BrowserWindow): void {
  const isApp = tabs?.isAppWindow(w.id)
  // son normal pencere kapaniyorsa uygulama pencereleri de kapanir (uygulama sonlanir)
  if (!isApp && tabs && tabs.normalWindowIds().filter((x) => x !== w.id).length === 0 && shellWins.size > 1) { quitting = true; for (const x of [...shellWins.values()]) if (x !== w && !x.isDestroyed()) x.destroy() }
  if (quitting || shellWins.size <= 1) { shellWins.delete(w.id); return }
  const fallback = isApp ? [...shellWins.values()].find((x) => !tabs.isAppWindow(x.id) && !x.isDestroyed()) ?? [...shellWins.values()].find((x) => x.id !== w.id && !x.isDestroyed()) : [...shellWins.values()].find((x) => x.id !== w.id && !x.isDestroyed() && !tabs.isAppWindow(x.id))
  if (fallback) tabs.removeWindow(w.id, fallback.id)
  shellWins.delete(w.id)
  if (win === w && fallback) win = fallback
  pushTabs()
}

/** Ikinci (ve sonraki) kabuk penceresi: sekme havuzu ortak; tercihen diger monitorde acilir. */
async function openWindow(opts: { app?: boolean } = {}): Promise<number> {
  const quiet = !!process.env.DB_SCRIPT && !process.env.DB_VISIBLE
  const here = screen.getDisplayMatching((curWin ?? win).getBounds()), other = opts.app ? undefined : screen.getAllDisplays().find((d) => d.id !== here.id)
  const wa = (other ?? here).workArea
  const def = other ? { x: wa.x + 40, y: wa.y + 40, width: Math.max(900, wa.width - 80), height: Math.max(600, wa.height - 80) } : { x: wa.x + Math.floor(wa.width / 2), y: wa.y + 40, width: Math.max(900, Math.floor(wa.width / 2) - 20), height: Math.max(600, wa.height - 80) }
  // uygulama penceresi: kucuk, ekranin ortasinda, konumu hatirlanmaz
  const appDef = { width: Math.min(1100, wa.width - 80), height: Math.min(760, wa.height - 80), x: wa.x + Math.floor((wa.width - Math.min(1100, wa.width - 80)) / 2) + (shellWins.size % 5) * 24, y: wa.y + 50 + (shellWins.size % 5) * 24 }
  const { maximized, ...b } = opts.app ? { ...appDef, maximized: false } : restoreWindowState(def, 'window2')
  const w = new BrowserWindow({ ...b, ...(quiet ? { show: false, focusable: false } : {}), minWidth: opts.app ? 480 : 900, minHeight: opts.app ? 360 : 600, titleBarStyle: 'hiddenInset', ...windowChrome(), vibrancy: 'under-window', visualEffectState: 'active', webPreferences: { preload: join(__dirname, '../preload/index.js'), sandbox: true, contextIsolation: true, nodeIntegration: false } })
  w.webContents.setVisualZoomLevelLimits(1, 1).catch(() => {})
  if (maximized && !quiet) w.maximize()
  if (quiet) { w.setOpacity(0); w.setIgnoreMouseEvents(true); w.showInactive() }
  if (!opts.app) trackWindowState(w, 'window2')
  shellWins.set(w.id, w); w.on('close', () => onShellClose(w))
  const id = tabs.addWindow(w, !!opts.app)
  lockShell(w, [process.env.ELECTRON_RENDERER_URL ?? 'app://shell/'])
  await w.loadURL((process.env.ELECTRON_RENDERER_URL ?? 'app://shell/index.html') + (opts.app ? '?app=1' : ''))
  pushWorkspaces(); pushTabs(); pushRules(); pushLibrary(); pushSessions(); pushSettings()
  return id
}

/** Tema: nativeTheme kaynagi ayarlanir; kabuk ve eklenti CSS'i prefers-color-scheme ile ayni kaynagi izler. Opak pencerelerin zemini de guncellenir. */
function applyTheme(pref: 'system' | 'light' | 'dark'): void {
  nativeTheme.themeSource = pref
  if (process.platform !== 'darwin') for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0a0a0b' : '#f5f5f7')
}
nativeTheme.on('updated', () => { if (process.platform !== 'darwin') for (const w of BrowserWindow.getAllWindows()) if (!w.isDestroyed()) w.setBackgroundColor(nativeTheme.shouldUseDarkColors ? '#0a0a0b' : '#f5f5f7') })

async function createWindow(): Promise<void> {
  // Test modu (DB_SCRIPT): kullaniciyi rahatsiz etme — Dock'a dusme, one gelme, gorunmez (opacity 0) ama render ediliyor. DB_VISIBLE=1 ile normal gorunur.
  applyTheme((settings ?? new SettingsStore()).get().theme ?? 'system') // cam (vibrancy) ve prefers-color-scheme secilen temayi izler
  const quiet = !!process.env.DB_SCRIPT && !process.env.DB_VISIBLE
  if (quiet && process.platform === 'darwin') app.setActivationPolicy('accessory')
  const { maximized, ...ws0 } = restoreWindowState({ width: 1500, height: 900 })
  win = new BrowserWindow({
    ...ws0, ...(quiet ? { show: false, focusable: false } : {}), minWidth: 900, minHeight: 600, titleBarStyle: 'hiddenInset', ...windowChrome(), vibrancy: 'under-window', visualEffectState: 'active', // macOS cam: masaustu bulanik gorunur, shell kartlari saydam
    
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
  notes = new NoteStore(app.getPath('userData'))
  usage = new UsageStore(app.getPath('userData'))
  perfHist = new PerfHistory(app.getPath('userData'))
  for (const w of workspaces.list()) { const part = partitionFor(w.id); await loadExtensionsInto(session.fromPartition(part), part) }
  syncSt = { ...syncSt, ...(loadDocS<SyncSt>(app.getPath('userData'), 'syncstate') ?? {}) }
  syncSvc = new SyncService({ build: buildSync, apply: applySync, pass: syncPass, dir: () => settings.get().syncDir || icloudDir() })
  if (syncSt.enabled) { setTimeout(() => runSync(), 5000); setInterval(() => { if (syncSt.enabled) runSync() }, 10 * 60_000).unref() }
  ai = new AiService(app.getPath('userData'), process.env.DB_SCRIPT ? plainCipher : keychainCipher, () => (settings.get().ai ?? { provider: 'ollama', model: 'llama3.1' }) as AiConfig)
  widgets = new WidgetService(app.getPath('userData'),
    (u) => net.fetch(u, { signal: AbortSignal.timeout(8000) }).then((r) => (r.ok ? r.text() : null), () => null),
    (r) => { notified.push(r.text); if (process.env.DB_SCRIPT) return; const n = new Notification({ title: tr('rem.title'), body: r.text }); n.on('click', () => { win.show(); win.focus() }); n.show() })
  widgets.start()
  await focusServer.start()
  if (!process.env.DB_SCRIPT) {
    const notify = async (): Promise<void> => { const u = await checkUpdate(); if (u.newer && updNotified !== u.latest) { updNotified = u.latest; new Notification({ title: tr('upd.title'), body: tr('upd.body', { v: u.latest, c: u.electron }) }).show() } }
    setTimeout(() => void notify(), 8000); setInterval(() => void notify(), 12 * 3600_000).unref()
  }
  threat = new ThreatService(); void threat.refresh(); setInterval(() => void threat.refresh(), 6 * 3600_000).unref()
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
  }, (wsId) => rules.get(wsId), { detectedPorts: () => detected.map((d) => d.port), language: () => settings.get().language, searchEngine: () => settings.get().searchEngine ?? 'duckduckgo', onFavicons: (ses, u, urls) => void favicons.capture(ses, u, urls), onThumb: (u, wc) => { if (!thumbs.recentlyHas(u, 60_000)) void wc.capturePage().then((img) => thumbs.put(u, img)).catch(() => {}) }, onDomReady: (wc) => { void sites.apply(wc); void applyNotes(wc); void adblock.cosmetic(wc); void adblock.consent(wc, settings.get().cookieBanners !== false); void injectAmbient(wc) }, sleepMinutes: () => settings.get().sleepMinutes ?? 30, focusBlock, shortcuts: () => mergeShortcuts(settings.get().shortcuts), onDivert: (id, url, mode) => { const e = tabs.get(id); if (!e) return; if (mode === 'normal') { const nw = tabs.normalWindowIds()[0]; if (nw !== undefined) void tabs.create({ url, workspaceId: e.info.workspaceId, winId: nw }).then((nid) => tabs.activate(nid)); return } if (mode === 'window') void openInNewWindow(url, e.info.workspaceId, e.winId, e.info.private); else void tabs.create({ url, workspaceId: e.info.workspaceId, winId: e.winId, ...(e.info.private ? { private: e.info.private } : {}) }) }, httpsOnly: () => settings.get().httpsOnly !== false, onContextMenu: (id, params) => void showCtx(id, params), loginCount: (url) => passwords?.count(url) ?? 0, onAttached: async (wc, id) => { await passwords?.attach(wc); await stateBridge.attach(wc, id) }, siteInfo: (url) => { const h = siteHost(url); const s = h ? sites.get(h) : undefined; return s && (s.zoom || s.dark) ? { ...(s.zoom ? { zoom: s.zoom } : {}), ...(s.dark ? { dark: true } : {}) } : undefined }, stripTracking: () => ({ on: settings.get().stripTracking !== false, dev: !!settings.get().stripTrackingDev }), adCfg, onFocusWindow: (w) => { if (!process.env.DB_SCRIPT || process.env.DB_VISIBLE) { if (w.isMinimized()) w.restore(); w.focus() } }, openWindow, torPort: async () => { const r = await tor.ensure(); return r.ok ? r.port : null }, onFound: (id, active, total) => send(Ch.findResult, { id, active, total }), onVisit: (u, t) => library.addVisit(u, t), onSession: (ses) => { handleDisplayMedia(ses); { const part = [...(workspaces?.list() ?? []).map((w) => partitionFor(w.id)), 'persist:ws-default', 'incog-main', 'tor-main'].find((p) => session.fromPartition(p) === ses); if (part) void loadExtensionsInto(ses, part) }; ses.setSpellCheckerEnabled(settings.get().spellcheck !== false); if (process.platform !== 'darwin') ses.setSpellCheckerLanguages(settings.get().language === 'tr' ? ['tr', 'en-US'] : ['en-US']); downloads.attach(ses); lockPermissions(ses, permissionHandlers); trustLoopbackCerts(ses) } })
  installMenu((cmd) => send(Ch.cmd, cmd), settings.get().language)
  dbg = new DebuggerService((id) => { const e = tabs.get(id); const wc = e?.view.webContents; return e && wc && !wc.isDestroyed() ? { client: electronCdp(wc, false), resolver: e.cdp?.resolver } : null }, (id, ev) => send(Ch.dbgEvent, { id, ...ev }))
  servers = new DevServers((e) => send(Ch.srvEvent, e), (wsId, url) => { void tabs.create({ url, workspaceId: wsId, activate: wsId === activeWorkspaceId }) })
  proxy = new CdpProxy((id) => { const wc = tabs.get(id)?.view.webContents; return wc && !wc.isDestroyed() ? electronCdp(wc, false) : null }, (id, method, params) => send(Ch.dtEvent, { id, method, params }))
  registerIpc()
  setInterval(() => bus.compact(), 10_000).unref()
  bus.subscribe((ev, change) => send(change === 'new' ? Ch.evNew : Ch.evUpdate, ev))

  lockShell(win, [process.env.ELECTRON_RENDERER_URL ?? 'app://shell/'])
  if (process.env.ELECTRON_RENDERER_URL) await win.loadURL(process.env.ELECTRON_RENDERER_URL)
  else { serveApp(join(__dirname, '../renderer')); await win.loadURL('app://shell/index.html') }

  const restored = process.env.DB_SCRIPT && !process.env.DB_RESTORE ? false : await tabs.restore()
  setInterval(updateBadge, 1500).unref()
  if (!restored) await newTab(process.env.DB_URL)
  if (!process.env.DB_SCRIPT) void hubAutostart()
  void pollServers(); setInterval(pollServers, 1500)
  // kullanim takibi (1 sn): odaktaki pencerenin aktif sekmesi, bosta degil, gizli degil; engelli hale gelirse sayfa engel sayfasina doner
  setInterval(() => {
    const idle = powerMonitor.getSystemIdleTime() < 60
    for (const v of tabs.visibleTabs()) {
      if (v.private || v.overlay || !/^https?:/.test(v.url)) continue
      let host = ''; try { host = new URL(v.url).hostname.toLowerCase() } catch { continue }
      if (host === 'localhost' || host === '127.0.0.1' || !host.includes('.')) continue
      if ((v.focused && idle) || process.env.DB_TRACK_ALWAYS) usage.add(siteOfUsage(host))
      if (focusBlock(v.url)) tabs.go(v.tabId, v.url) // odak acildi / limit doldu: engel sayfasi
    }
  }, 1000).unref()
  pushWorkspaces(); pushTabs(); pushRules(); pushLibrary(); pushSessions(); pushSettings()
  telemetry.track('app.start')

  // Otomatik test modu: DB_SCRIPT = ({ctx}) => Promise<any>; sonuc ve olaylar DB_DUMP'a yazilir
  if (process.env.DB_SCRIPT) {
    const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))
    // betiklerin mevcut varsayilani: Timeline (arayuzun varsayilani Overview)
    await win.webContents.executeJavaScript(`new Promise((r)=>{const go=(n)=>{const pt=document.querySelector('.panel-toggle');if(pt&&pt.getAttribute('aria-pressed')==='false')pt.click();const b=[...document.querySelectorAll('.seg2 > button')].find(x=>x.textContent==='Timeline');if(b){b.click();r(1)}else if(n>0)setTimeout(()=>go(n-1),100);else r(0)};go(30)})`).catch(() => {})
    const ctx = {
      app, win, tabs, bus, library, downloads, handleLaunch, settings, telemetry, demo, exportReport: (p: string) => exportReport(win, tabs, bus, (id) => workspaces.get(id)?.name ?? id, p), workspaces, rules, sleep, refreshRules: () => { tabs.refreshRules(); pushRules() }, detected: () => detected, pushTabs, detectServers,
      newTab, openWindow, openAppWindow, usage: () => usage, widgets: () => widgets, notified, shellWins, passwords, cardState, recorder, notes: () => notes, applyNotes, lastSpeak: () => lastSpeak, displayRequests: () => displayRequests, perms,
      ctxPrepare: (id: string, params: Partial<Electron.ContextMenuParams>) => showCtx(id, { x: 20, y: 20, ...params } as Electron.ContextMenuParams, true), editorOpens: () => lastEditorOpen, lastShot: () => lastShot, resetCtx: () => { lastEditorOpen = null; lastShot = null },
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
    writeFileSync(process.env.DB_DUMP ?? require('os').tmpdir() + '/izlix-e2e-db-result.json', JSON.stringify({ result, events: tabId ? bus.snapshot(tabId) : [] }, null, 1))
    app.quit()
  }
}

const gotLock = process.env.DB_SCRIPT ? true : app.requestSingleInstanceLock()
if (!gotLock) app.quit()
app.on('second-instance', (_e, argv, cwd) => { const l = parseLaunch(argv, cwd); if (l) void handleLaunch(l) })
app.on('open-url', (e, url) => { e.preventDefault(); const l = parseLaunch([url]); if (l) void handleLaunch(l) })
if (!process.env.DB_SCRIPT) app.setAsDefaultProtocolClient('izlix')
if (gotLock) app.whenReady().then(async () => { await createWindow(); if (pendingLaunch) { const l = pendingLaunch; pendingLaunch = null; await handleLaunch(l) } })
app.on('before-quit', () => { quitting = true; speaker.stop(); notes?.flush(); usage?.flush(); library?.flush(); favicons?.flush(); thumbs?.flush(); servers?.stopAll(); tor.stop() })
app.on('window-all-closed', () => app.quit())
