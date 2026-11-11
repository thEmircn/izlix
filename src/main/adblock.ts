import type { WebContents } from 'electron'
import { COSMETIC_CSS, YOUTUBE_SCRIPT, inSet, isLoopbackHost, type BlockLevel } from '../shared/adblock'

export interface AdCfg { level: BlockLevel; allow: string[]; blockOnDev: boolean }

/** Reklam engelleyici (sayfa tarafi): gorunum CSS'i + YouTube reklam atlayici. Ag engelleme Interceptor'da (CDP Fetch). */
export class AdBlocker {
  constructor(private cfg: () => AdCfg) {}

  /** dom-ready: gorunum CSS'i ve (YouTube'da) reklam atlayici */
  async cosmetic(wc: WebContents): Promise<void> {
    const c = this.cfg(); if (c.level === 'off' || wc.isDestroyed()) return
    let host = ''; try { host = new URL(wc.getURL()).hostname.toLowerCase() } catch { return }
    if (!host || (isLoopbackHost(host) && !c.blockOnDev) || inSet(host, new Set(c.allow))) return
    await wc.insertCSS(COSMETIC_CSS).catch(() => {})
    if (/(^|\.)youtube\.com$/.test(host)) await wc.executeJavaScript(YOUTUBE_SCRIPT).catch(() => {})
  }
}
