import type { WebContents } from 'electron'
import { existsSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'
import { SourceResolver as CoreSourceResolver, type SourceHost } from '../core/sources'
import { electronCdp } from './electron-cdp'

export { parseSourceMap, type SrcLoc } from '../core/sources'

/** Electron: dosya sistemi + oturumun fetch'i (cerez/proxy ayni) + Node yol islemleri */
const electronHost = (wc: WebContents): SourceHost => ({
  fetchText: async (url) => (await wc.session.fetch(url)).text(),
  alive: () => !wc.isDestroyed(),
  exists: (p) => existsSync(p),
  join: (root, rel) => join(root, rel),
  isInside: (root, file) => resolve(file).startsWith(resolve(root) + sep)
})

/** Electron sekmesi icin kaynak cozumleyici: ortak cekirdek + Electron host'u (debugger oturumu attachCdp'ninkiyle paylasilir) */
export class SourceResolver extends CoreSourceResolver {
  constructor(wc: WebContents) { super(electronCdp(wc, false), electronHost(wc)) }
}
