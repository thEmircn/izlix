import type { WebContents } from 'electron'
import type { EventBus } from '../core/bus'
import { electronCdp } from './electron-cdp'
import { attachCollector, type Collector } from '../core/collector'
import { SourceResolver } from './sources'

export { ClockSync, handleBridge } from '../core/collector'
export { electronCdp }
export type Tab = Collector<SourceResolver>

// NOT: webContents'e ilk sayfa yuklenmeden CDP komutlari yanit vermez; cagiran once about:blank yuklemeli.
// NOT: Debugger domain'i burada ACILMAZ: yukleme suresini ~%60 sisirir (bkz. sources.ts).
/** Electron sekmesine toplayiciyi baglar (kaynak cozumleyici Electron'a ozgu: dosya sistemi + kaynak haritasi) */
export async function attachCdp(wc: WebContents, tabId: string, bus: EventBus, rootProvider?: () => string | null, sensitiveTab?: () => boolean): Promise<Tab> {
  const resolver = new SourceResolver(wc)
  resolver.rootProvider = rootProvider ?? null
  return attachCollector(electronCdp(wc), tabId, bus, { resolver, ...(sensitiveTab ? { sensitiveTab } : {}) })
}
