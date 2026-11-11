// Izlix for Chrome: arka plan (service worker). Cekirdek toplayici Electron'daki ile AYNI koddur (src/core).
import { EventBus } from '../../../src/core/bus'
import { attachCollector, type Collector } from '../../../src/core/collector'
import { chromeCdp, isAttached } from './chrome-cdp'
import { emptyResolver } from './stub-resolver'

const bus = new EventBus()
const tabKey = (tabId: number): string => `tab-${tabId}`
const attached = new Map<number, Collector>()

/** Sekmeyi izlemeye baslar (zaten bagliysa bir sey yapmaz). Kopru betigi yalnizca sonraki yuklemede devreye girer: sekme yenilenir. */
export async function ensureAttached(tabId: number, reload = true): Promise<void> {
  if (attached.has(tabId)) return
  const client = await chromeCdp(tabId)
  attached.set(tabId, await attachCollector(client, tabKey(tabId), bus, { resolver: emptyResolver() }))
  if (reload) await chrome.tabs.reload(tabId)
}
function release(tabId: number): void { attached.get(tabId)?.detach(); attached.delete(tabId); bus.dropTab(tabKey(tabId)) }

chrome.debugger.onDetach.addListener((src) => { if (src.tabId != null) { attached.delete(src.tabId) } }) // kullanici seridi kapatti / sekme gitti
chrome.tabs.onRemoved.addListener((tabId) => release(tabId))

// Arac cubugu dugmesi: bu sekme icin paneli ac ve izlemeyi baslat
chrome.action.onClicked.addListener(async (tab) => {
  if (tab.id == null) return
  await chrome.sidePanel.setOptions({ tabId: tab.id, path: `panel.html?tabId=${tab.id}`, enabled: true })
  await chrome.sidePanel.open({ tabId: tab.id })
  await ensureAttached(tab.id)
})

// Panel <-> arka plan: olaylar canli akar, baglaninca gecmis gonderilir
chrome.runtime.onConnect.addListener((port) => {
  if (port.name !== 'izlix-panel') return
  let off = (): void => {}
  port.onMessage.addListener((m: { t: string; tabId: number }) => {
    if (m.t !== 'hello') return
    const key = tabKey(m.tabId)
    port.postMessage({ t: 'events', events: bus.snapshot(key) })
    off = bus.subscribe((e, change) => { if (e.tabId === key) port.postMessage({ t: 'ev', change, e }) })
  })
  port.onDisconnect.addListener(() => off())
})

// Test/gelistirme girisi (service worker kapsami sayfalardan erisilemez)
;(globalThis as any).__izlix = { ensureAttached, bus, isAttached, attached: () => [...attached.keys()] }
