// Izlix for Chrome: arka plan (service worker). Cekirdek toplayici Electron'daki ile AYNI koddur (src/core).
import { EventBus } from '../../../src/core/bus'
import { attachCollector, type Collector } from '../../../src/core/collector'
import { Interceptor } from '../../../src/core/interceptor'
import { DEFAULT_DOMAINS, type RulesConfig } from '../../../src/shared/rules'
import { chromeCdp, isAttached } from './chrome-cdp'
import { emptyResolver } from './stub-resolver'
import type { CdpClient } from '../../../src/core/cdp-client'

const bus = new EventBus()
const tabKey = (tabId: number): string => `tab-${tabId}`
interface Attached { collector: Collector; client: CdpClient; interceptor: Interceptor }
const attached = new Map<number, Attached>()
const tabUrls = new Map<number, string>()
const ports = new Set<chrome.runtime.Port>()

// --- Request Rules: kurallar kalici (chrome.storage), her izlenen sekmede ayni cekirdek Interceptor calisir ---
let rulesCfg: RulesConfig = { rules: [], domains: DEFAULT_DOMAINS }
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
  const collector = await attachCollector(client, tabKey(tabId), bus, { resolver: emptyResolver() })
  tabUrls.set(tabId, (await chrome.tabs.get(tabId)).url ?? '')
  const interceptor = new Interceptor({ client, url: () => tabUrls.get(tabId) ?? '', alive: () => attached.has(tabId) }, tabKey(tabId), bus, () => rulesCfg)
  attached.set(tabId, { collector, client, interceptor })
  await interceptor.refresh()
  if (reload) await chrome.tabs.reload(tabId)
}
function release(tabId: number): void { const a = attached.get(tabId); if (a) { a.interceptor.detach(); a.collector.detach() } attached.delete(tabId); tabUrls.delete(tabId); bus.dropTab(tabKey(tabId)) }

chrome.debugger.onDetach.addListener((src) => { if (src.tabId != null) { attached.get(src.tabId)?.interceptor.detach(); attached.delete(src.tabId) } })
// sayfa adresi degisince kural alan adi denetimi ve Fetch alani yeniden degerlendirilir
chrome.tabs.onUpdated.addListener((tabId, info) => { const a = attached.get(tabId); if (a && info.url) { tabUrls.set(tabId, info.url); a.interceptor.setPageUrl(info.url); void a.interceptor.refresh() } }) // kullanici seridi kapatti / sekme gitti
chrome.tabs.onRemoved.addListener((tabId) => release(tabId))

// Arac cubugu dugmesi: bu sekme icin paneli ac ve izlemeyi baslat
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return
  await chrome.sidePanel.setOptions({ tabId: tab.id, path: `panel.html?tabId=${tab.id}`, enabled: true })
  await chrome.sidePanel.open({ tabId: tab.id })
  await ensureAttached(tab.id)
})

// Panel <-> arka plan: olaylar canli akar, baglaninca gecmis gonderilir
/** Panelden gelen cagrilar (preload API'sinin eklentide gereken kismi) */
async function rpc(name: string, args: any[]): Promise<unknown> {
  await rulesReady
  switch (name) {
    case 'getRules': return rulesCfg
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
    default: return null
  }
}

chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'izlix-panel') return
  let off = (): void => {}
  ports.add(port)
  port.onMessage.addListener((m: any) => {
    if (m.t === 'hello') {
      const key = tabKey(m.tabId)
      port.postMessage({ t: 'events', events: bus.snapshot(key) })
      off = bus.subscribe((e, change) => { if (e.tabId === key) port.postMessage({ t: 'ev', change, e }) })
    } else if (m.t === 'rpc') void rpc(m.name, m.args).then((value) => port.postMessage({ t: 'rpc', id: m.id, value }))
  })
  port.onDisconnect.addListener(() => { off(); ports.delete(port) })
})

// Test/gelistirme girisi (service worker kapsami sayfalardan erisilemez)
;(globalThis as any).__izlix = { ensureAttached, bus, isAttached, attached: () => [...attached.keys()], setRules, rules: () => rulesCfg }
