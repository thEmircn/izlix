import { webContents, type Session, type WebContents } from 'electron'
import { COSMETIC_CSS, YOUTUBE_SCRIPT, decide, inSet, isLoopbackHost, type BlockLevel, type BlockReason } from '../shared/adblock'

export interface AdCfg { level: BlockLevel; allow: string[]; blockOnDev: boolean }

/** Reklam/izleyici engelleyici: oturum basina webRequest + sayfaya gorunum CSS'i + YouTube reklam atlayici. */
export class AdBlocker {
  private seen = new WeakSet<Session>()
  constructor(private cfg: () => AdCfg, private onBlocked: (webContentsId: number | undefined, reason: BlockReason) => void = () => {}) {}

  attach(ses: Session): void {
    if (this.seen.has(ses)) return
    this.seen.add(ses)
    ses.webRequest.onBeforeRequest({ urls: ['http://*/*', 'https://*/*', 'ws://*/*', 'wss://*/*'] }, (d, cb) => {
      const c = this.cfg()
      if (c.level === 'off') { cb({}); return }
      const wc = d.webContentsId ? webContents.fromId(d.webContentsId) : undefined
      const page = wc && !wc.isDestroyed() ? wc.getURL() : undefined
      const r = decide(d.url, d.resourceType, page, { level: c.level, allow: c.allow, blockOnDev: c.blockOnDev })
      if (r) this.onBlocked(d.webContentsId, r)
      cb({ cancel: !!r })
    })
  }

  /** dom-ready: gorunum CSS'i ve (YouTube'da) reklam atlayici */
  async cosmetic(wc: WebContents): Promise<void> {
    const c = this.cfg(); if (c.level === 'off' || wc.isDestroyed()) return
    let host = ''; try { host = new URL(wc.getURL()).hostname.toLowerCase() } catch { return }
    if (!host || (isLoopbackHost(host) && !c.blockOnDev) || inSet(host, new Set(c.allow))) return
    await wc.insertCSS(COSMETIC_CSS).catch(() => {})
    if (/(^|\.)youtube\.com$/.test(host)) await wc.executeJavaScript(YOUTUBE_SCRIPT).catch(() => {})
  }
}
