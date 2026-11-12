// Izlix for Chrome: arka plan (service worker). Cekirdek toplayici Electron'daki ile AYNI koddur (src/core).
import { EventBus } from '../../../src/core/bus'
import { attachCollector, type Collector } from '../../../src/core/collector'
import { Interceptor } from '../../../src/core/interceptor'
import { CSS_SNAPSHOT } from '../../../src/main/css-snapshot'
import { A11Y_AUDIT } from '../../../src/main/a11y-audit'
import { SEO_SCRIPT } from '../../../src/main/seo-script'
import { IMAGE_AUDIT, LINK_CHECK } from '../../../src/main/page-tools'
import { DebuggerService } from '../../../src/core/debugger'
import { loadBundle } from '../../../src/main/source-bundle'
import { CdpProxy } from '../../../src/core/cdpproxy'
import { DEFAULT_DOMAINS, type RulesConfig } from '../../../src/shared/rules'
import { chromeCdp, isAttached } from './chrome-cdp'
import { createResolver } from './stub-resolver'
import { editorUrl, isSafeSourcePath } from '../../../src/shared/editor'
import type { SourceResolver } from '../../../src/core/sources'
import type { CdpClient } from '../../../src/core/cdp-client'
import { compareVersions, latestTagged } from '../../../src/shared/version'

const bus = new EventBus()
const tabKey = (tabId: number): string => `tab-${tabId}`
interface Attached { collector: Collector<SourceResolver>; client: CdpClient; interceptor: Interceptor }
const attached = new Map<number, Attached>()
const tabUrls = new Map<number, string>()
const ports = new Set<chrome.runtime.Port>()
// Elements/Storage panelleri: izin listeli CDP koprusu (panel acikken etkin, olaylar panele iletilir)
const proxy = new CdpProxy((key) => attached.get(Number(key.replace('tab-', '')))?.client ?? null, (id, method, params) => ports.forEach((p) => p.postMessage({ t: 'dt', id, method, params })))
const tabNum = (id: unknown): number => Number(String(id).replace('tab-', ''))
// Sources paneli: kesme noktasi / adimlama (cekirdek DebuggerService; panel acikken etkin)
const dbg = new DebuggerService((key) => { const a = attached.get(tabNum(key)); return a ? { client: a.client, resolver: a.collector.resolver } : null }, (id, e) => ports.forEach((p) => p.postMessage({ t: 'dbg', e: { id, ...e } })))

// --- Surum denetimi: GitHub'daki herkese acik release listesinden en yeni eklenti surumu (kullanici verisi gitmez); gunde bir ---
interface UpdateNotice { latest: string; url: string }
let updateNotice: UpdateNotice | null = null
const REL_URL = 'https://api.github.com/repos/thEmircn/izlix/releases?per_page=30'
export async function checkUpdate(tags?: string[]): Promise<UpdateNotice | null> {
  try {
    const list = tags ?? ((await (await fetch(REL_URL, { headers: { accept: 'application/vnd.github+json' } })).json()) as { tag_name: string }[]).map((r) => r.tag_name)
    const cur = chrome.runtime.getManifest().version_name ?? chrome.runtime.getManifest().version
    const best = latestTagged(list, 'ext-v')
    updateNotice = best && compareVersions(best.version, cur) === 1 ? { latest: best.version, url: `https://github.com/thEmircn/izlix/releases/tag/${best.tag}` } : null
    await chrome.storage.local.set({ 'izlix.update': { at: Date.now(), notice: updateNotice } })
    ports.forEach((p) => p.postMessage({ t: 'update', notice: updateNotice }))
  } catch { /* cevrimdisi: sessizce gec */ }
  return updateNotice
}
void chrome.storage.local.get('izlix.update').then((r) => { const u = r['izlix.update'] as { at: number; notice: UpdateNotice | null } | undefined; if (u?.notice) updateNotice = u.notice; if (!u || Date.now() - u.at > 20 * 3600_000) void checkUpdate() })
chrome.alarms.create('izlix-update', { periodInMinutes: 24 * 60 })
chrome.alarms.onAlarm.addListener((a) => { if (a.name === 'izlix-update') void checkUpdate() })

// --- Request Rules: kurallar kalici (chrome.storage), her izlenen sekmede ayni cekirdek Interceptor calisir ---
let rulesCfg: RulesConfig = { rules: [], domains: DEFAULT_DOMAINS }
let projectRoot: string | null = null
let editorPref: 'vscode' | 'cursor' | 'webstorm' = 'vscode'
void chrome.storage.local.get(['izlix.root', 'izlix.editor']).then((r) => { projectRoot = (r['izlix.root'] as string) || null; if (r['izlix.editor']) editorPref = r['izlix.editor'] as typeof editorPref })
const rulesReady = chrome.storage.local.get('izlix.rules').then((r) => { if (r['izlix.rules']) rulesCfg = r['izlix.rules'] as RulesConfig })
async function setRules(cfg: RulesConfig): Promise<void> {
  rulesCfg = { rules: cfg.rules ?? [], domains: cfg.domains?.length ? cfg.domains : DEFAULT_DOMAINS }
  await chrome.storage.local.set({ 'izlix.rules': rulesCfg })
  for (const a of attached.values()) void a.interceptor.refresh()
  ports.forEach((p) => p.postMessage({ t: 'rules', cfg: rulesCfg }))
}

/** Sekmeyi izlemeye baslar (zaten bagliysa bir sey yapmaz). Kopru betigi yalnizca sonraki yuklemede devreye girer: sekme yenilenir. */
export async function ensureAttached(tabId: number, reload = true): Promise<void> {
  if (attached.has(tabId)) return
  await rulesReady
  const client = await chromeCdp(tabId)
  const resolver = createResolver(client, () => attached.has(tabId), () => projectRoot)
  const collector = await attachCollector(client, tabKey(tabId), bus, { resolver })
  tabUrls.set(tabId, (await chrome.tabs.get(tabId)).url ?? '')
  const interceptor = new Interceptor({ client, url: () => tabUrls.get(tabId) ?? '', alive: () => attached.has(tabId) }, tabKey(tabId), bus, () => rulesCfg)
  attached.set(tabId, { collector, client, interceptor })
  await interceptor.refresh()
  if (reload) await chrome.tabs.reload(tabId)
}
function release(tabId: number): void { proxy.drop(tabKey(tabId)); dbg.drop(tabKey(tabId)); const a = attached.get(tabId); if (a) { a.interceptor.detach(); a.collector.detach() } attached.delete(tabId); tabUrls.delete(tabId); bus.dropTab(tabKey(tabId)) }

/** Chrome izlemeyi sonlandirdi (kullanici hata ayiklama seridini kapatti, DevTools acildi...): temizle ve panele bildir */
function onDetached(tabId: number, reason: string): void {
  proxy.drop(tabKey(tabId)); dbg.drop(tabKey(tabId)); const a = attached.get(tabId); if (a) { a.interceptor.detach(); a.collector.detach() }
  attached.delete(tabId); ports.forEach((p) => p.postMessage({ t: 'detached', tabId, reason }))
}
chrome.debugger.onDetach.addListener((src, reason) => { if (src.tabId != null) onDetached(src.tabId, reason) })
// sayfa adresi degisince kural alan adi denetimi ve Fetch alani yeniden degerlendirilir
chrome.tabs.onUpdated.addListener((tabId, info) => { const a = attached.get(tabId); if (a && info.url) { tabUrls.set(tabId, info.url); a.interceptor.setPageUrl(info.url); void a.interceptor.refresh() } }) // kullanici seridi kapatti / sekme gitti
chrome.tabs.onRemoved.addListener((tabId) => release(tabId))

// Arac cubugu dugmesi: Chrome paneli kendisi acar (kullanici hareketi gerektiren sidePanel.open'a gerek kalmaz); izleme panel acilinca baslar
void chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {})

/** Panelden gelen cagrilar (preload API'sinin eklentide gereken kismi) */
async function rpc(name: string, args: any[]): Promise<unknown> {
  await rulesReady
  switch (name) {
    case 'getRules': return rulesCfg
    case 'getPrefs': return { root: projectRoot ?? '', editor: editorPref }
    case 'setPrefs': {
      const { root, editor } = args[0] as { root: string; editor: string }
      const r = String(root ?? '').trim()
      projectRoot = r && isSafeSourcePath(r) ? r.replace(/[\\/]+$/, '') : null // yalniz mutlak ve .. icermeyen
      if (editor === 'vscode' || editor === 'cursor' || editor === 'webstorm') editorPref = editor
      await chrome.storage.local.set({ 'izlix.root': projectRoot ?? '', 'izlix.editor': editorPref })
      return { root: projectRoot ?? '', editor: editorPref }
    }
    case 'resume': { const id = Number(args[0]); try { await ensureAttached(id); return true } catch { return false } }
    case 'setRules': await setRules(args[1]); return true
    case 'responseBody': {
      const a = attached.get(Number(String(args[0]).replace('tab-', ''))); if (!a) return null
      try {
        const r: any = await a.client.send('Network.getResponseBody', { requestId: args[1] })
        if (String(r.body).length > 300_000) return null
        if (!r.base64Encoded) return String(r.body)
        const text = new TextDecoder().decode(Uint8Array.from(atob(r.body), (c) => c.charCodeAt(0)))
        return !text.includes('\uFFFD') && !/[\u0000-\u0008\u000E-\u001F]/.test(text) ? text : null
      } catch { return null }
    }
    case 'srcLoad': {
      // yalniz izlenen bir sekmenin kaynagiyla ayni kokenden http(s) adresleri (eklentinin ag erisimi baska yere kullanilamaz)
      const url = String(args[1]); const tid = tabNum(args[0])
      if (!attached.has(tid) || !/^https?:\/\//i.test(url)) return null
      try { if (new URL(url).origin !== new URL(tabUrls.get(tid) ?? '').origin) return null } catch { return null }
      return loadBundle(async (u) => { try { if (new URL(u).origin !== new URL(url).origin) return null; const r = await fetch(u); return r.ok ? await r.text() : null } catch { return null } }, url)
    }
    case 'srcPos': { const a = attached.get(tabNum(args[0])); const o = args[1] as { url: string; line: number; col: number }; return a ? a.collector.resolver.resolveFrame(undefined, o.line - 1, o.col - 1, o.url).catch(() => null) : null }
    case 'dbgEnable': return dbg.enable(String(args[0]))
    case 'dbgDisable': await dbg.disable(String(args[0])); return true
    case 'dbgSetBp': { const o = args[1] as { url?: string; file?: string; line: number; condition?: string }; return o?.line ? dbg.setBreakpoint(String(args[0]), { url: o.url, file: o.file, line: o.line | 0, condition: o.condition }) : { error: 'no line' } }
    case 'dbgRemoveBp': await dbg.removeBreakpoint(String(args[0]), String(args[1])); return true
    case 'dbgControl': { const c = String(args[1]); if (['resume', 'stepOver', 'stepInto', 'stepOut', 'pause'].includes(c)) await dbg.control(String(args[0]), c as any); return true }
    case 'dbgExceptions': { const st = String(args[1]); if (['none', 'uncaught', 'all'].includes(st)) await dbg.setExceptions(String(args[0]), st as any); return true }
    case 'dbgEventBp': return args[1] === 'xhr' ? dbg.setXhrBreakpoint(String(args[0]), String(args[2]), !!args[3]) : dbg.setEventBreakpoint(String(args[0]), String(args[2]), !!args[3])
    case 'dbgScope': return dbg.scope(String(args[0]), String(args[1]))
    case 'dbgEval': return dbg.evalOnFrame(String(args[0]), String(args[1]), String(args[2]))
    case 'reload': { try { await chrome.tabs.reload(Number(String(args[0]).replace('tab-', ''))); return true } catch { return false } }
    case 'audit': {
      // yalniz sabit betikler (panelden betik metni alinmaz)
      const scripts: Record<string, { code: string; async?: boolean; timeout: number }> = {
        a11y: { code: A11Y_AUDIT, timeout: 2000 }, seo: { code: SEO_SCRIPT, timeout: 2000 }, images: { code: IMAGE_AUDIT, timeout: 2000 }, links: { code: LINK_CHECK, async: true, timeout: 30_000 }
      }
      const sc = scripts[String(args[1])]; const a = attached.get(Number(String(args[0]).replace('tab-', ''))); if (!sc || !a) return null
      try { const r: any = await a.client.send('Runtime.evaluate', { expression: sc.code, returnByValue: true, awaitPromise: !!sc.async, timeout: sc.timeout }); return r.result?.value ?? null } catch { return null }
    }
    case 'cssSnap': {
      const a = attached.get(Number(String(args[0]).replace('tab-', ''))); if (!a) return null
      try { const r: any = await a.client.send('Runtime.evaluate', { expression: CSS_SNAPSHOT, returnByValue: true, timeout: 2000 }); return r.result?.value ?? null } catch { return null }
    }
    case 'dtCall': return proxy.call(String(args[0]), String(args[1]), args[2] as object | undefined).catch(() => null)
    case 'dtEnable': await proxy.enable(String(args[0]), args[1] as any); return true
    case 'dtDisable': await proxy.disable(String(args[0]), args[1] as any); return true
    case 'dtReact': return proxy.reactChain(String(args[0]), Number(args[1])).then((c) => c?.map((x) => ({ name: x.name }))).catch(() => null)
    case 'dtReactIdx': return proxy.reactIndex(String(args[0]), Number(args[1])).catch(() => null)
    case 'openSource': {
      // sayfa kontrollu veri: yalniz mutlak/guvenli yol VE bu sekmenin source map'lerinden gelen (bilinen) dosya VE sekme yerel gelistirme adresinde
      const { file, line, column, editor } = args[0] as { file: string; line: number; column?: number; editor?: 'vscode' | 'cursor' | 'webstorm' }
      if (!isSafeSourcePath(file)) return false
      const ok = [...attached.entries()].some(([tid, a]) => a.collector.resolver.knownFiles.has(file) && /^https?:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/.test(tabUrls.get(tid) ?? ''))
      if (!ok) return false
      const url = editorUrl(editor ?? editorPref, file, Math.max(1, line | 0), Math.max(1, (column ?? 1) | 0))
      ;(globalThis as any).__izlixLastEditorUrl = url
      if (!(globalThis as any).__izlixTestMode) { const t = await chrome.tabs.create({ url, active: false }); setTimeout(() => { if (t.id != null) void chrome.tabs.remove(t.id).catch(() => {}) }, 1500) }
      return true
    }
    default: return null
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'izlix-panel') return
  let off = (): void => {}
  ports.add(port)
  port.onMessage.addListener((m: any) => {
    if (m.t === 'hello') {
      // panel bir sekmeyi izlemek ister: gerekirse izlemeyi baslat, gecmisi gonder, canli olaylara abone ol (onceki abonelik kapanir)
      off()
      port.postMessage({ t: 'update', notice: updateNotice })
      const key = tabKey(m.tabId)
      void ensureAttached(m.tabId).then(() => {
        port.postMessage({ t: 'events', tabId: m.tabId, events: bus.snapshot(key) })
        off = bus.subscribe((e, change) => { if (e.tabId === key) port.postMessage({ t: 'ev', change, e }) })
      }).catch((err) => port.postMessage({ t: 'attach-error', tabId: m.tabId, message: String(err?.message ?? err) }))
    } else if (m.t === 'rpc') void rpc(m.name, m.args).then((value) => port.postMessage({ t: 'rpc', id: m.id, value }))
  })
  port.onDisconnect.addListener(() => { off(); ports.delete(port) })
})

// Test/gelistirme girisi (service worker kapsami sayfalardan erisilemez)
;(globalThis as any).__izlix = { knownFiles: (tid: number) => attached.get(tid)?.collector.resolver.knownFiles ?? new Set<string>(), onDetached, prefs: () => ({ root: projectRoot, editor: editorPref }), checkUpdate, setTestMode: (v: boolean) => { (globalThis as any).__izlixTestMode = v }, lastEditorUrl: () => (globalThis as any).__izlixLastEditorUrl, ensureAttached, bus, isAttached, attached: () => [...attached.keys()], setRules, rules: () => rulesCfg }
