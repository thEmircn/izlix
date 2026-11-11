import type { CdpClient } from '../../../src/core/cdp-client'
import { SourceResolver, type SourceHost } from '../../../src/core/sources'

const norm = (p: string): string => p.replace(/\\/g, '/').replace(/\/+$/, '')
/** Eklenti host'u: dosya sistemi yok (kaynak yollari source map'ten gelir), ag istekleri eklentinin fetch'iyle */
const extensionHost = (alive: () => boolean): SourceHost => ({
  fetchText: async (url) => (await fetch(url)).text(),
  alive,
  join: (root, rel) => `${norm(root)}/${rel.replace(/^\/+/, '')}`,
  isInside: (root, file) => norm(file).startsWith(norm(root) + '/') && !norm(file).split('/').includes('..')
})

/** Kaynak cozumleyici: Electron'daki ile ayni cekirdek sinif. Proje kok klasoru chrome.storage'dan ('izlix.root') okunur. */
export function createResolver(client: CdpClient, alive: () => boolean, root: () => string | null): SourceResolver {
  const r = new SourceResolver(client, extensionHost(alive))
  r.rootProvider = root
  return r
}
