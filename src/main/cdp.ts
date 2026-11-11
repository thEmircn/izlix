import type { WebContents } from 'electron'
import type { EventBus } from '../core/bus'
import type { CdpClient } from '../core/cdp-client'
import { attachCollector, type Collector } from '../core/collector'
import { SourceResolver } from './sources'

export { ClockSync, handleBridge } from '../core/collector'
export type Tab = Collector<SourceResolver>

/** Electron'un webContents.debugger'ini ortak CdpClient arayuzune uyarlar (attach dahil) */
export function electronCdp(wc: WebContents, attach = true): CdpClient {
  const dbg = wc.debugger
  if (attach) dbg.attach('1.3')
  return {
    send: (method, params) => dbg.sendCommand(method, params ?? {}),
    onEvent: (fn) => { const l = (_e: unknown, method: string, p: any): void => fn(method, p); dbg.on('message', l); return () => { dbg.removeListener('message', l) } },
    detach: () => { if (attach) dbg.detach() }
  }
}

// NOT: webContents'e ilk sayfa yuklenmeden CDP komutlari yanit vermez; cagiran once about:blank yuklemeli.
// NOT: Debugger domain'i burada ACILMAZ: yukleme suresini ~%60 sisirir (bkz. sources.ts).
/** Electron sekmesine toplayiciyi baglar (kaynak cozumleyici Electron'a ozgu: dosya sistemi + kaynak haritasi) */
export async function attachCdp(wc: WebContents, tabId: string, bus: EventBus, rootProvider?: () => string | null, sensitiveTab?: () => boolean): Promise<Tab> {
  const resolver = new SourceResolver(wc)
  resolver.rootProvider = rootProvider ?? null
  return attachCollector(electronCdp(wc), tabId, bus, { resolver, ...(sensitiveTab ? { sensitiveTab } : {}) })
}
