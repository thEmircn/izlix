import type { WebContents } from 'electron'
import type { EventBus } from '../core/bus'
import { Interceptor as CoreInterceptor, type AdHook } from '../core/interceptor'
import type { RulesConfig } from '../shared/rules'
import { electronCdp } from './electron-cdp'
import { MockServer } from './mockserver'

export type { AdHook }
const mockServer = new MockServer()

/** Electron sekmesi icin Request Rules/reklam engelleyici: ortak cekirdek uygulayicisi + Electron'a ozgu CDP istemcisi ve yerel mock sunucusu */
export class Interceptor extends CoreInterceptor {
  constructor(wc: WebContents, tabId: string, bus: EventBus, config: () => RulesConfig, ad?: AdHook) {
    // attachCdp debugger'i zaten baglamistir: ayni oturum paylasilir (yeniden attach yok)
    super({ client: electronCdp(wc, false), url: () => wc.getURL(), alive: () => !wc.isDestroyed() }, tabId, bus, config, ad, mockServer)
  }
}
