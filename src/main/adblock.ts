import type { WebContents } from 'electron'
import { CONSENT_CSS, CONSENT_SCRIPT } from '../shared/consent'
import { COSMETIC_CSS, YOUTUBE_SCRIPT, inSet, isLoopbackHost, type BlockLevel } from '../shared/adblock'

export interface AdCfg { level: BlockLevel; allow: string[]; blockOnDev: boolean }

/** Reklam engelleyici (sayfa tarafi): gorunum CSS'i + YouTube reklam atlayici. Ag engelleme Interceptor'da (CDP Fetch). */
export class AdBlocker {
  constructor(private cfg: () => AdCfg) {}

  /** dom-ready: gorunum CSS'i ve (YouTube'da) reklam atlayici */
  /** Cerez/KVKK bannerlari: gizle + reddet (adblock ayarindan bagimsiz); yerel dev sayfalarina dokunmaz (`blockOnDev` ile acilir) */
  async consent(wc: WebContents, on: boolean): Promise<void> {
    if (!on || wc.isDestroyed()) return
    const c = this.cfg(); let host = ''; try { host = new URL(wc.getURL()).hostname.toLowerCase() } catch { return }
    if (!host || (isLoopbackHost(host) && !c.blockOnDev)) return
    await wc.insertCSS(CONSENT_CSS).catch(() => {})
    await wc.executeJavaScript(CONSENT_SCRIPT).catch(() => {})
  }

  async cosmetic(wc: WebContents): Promise<void> {
    const c = this.cfg(); if (c.level === 'off' || wc.isDestroyed()) return
    let host = ''; try { host = new URL(wc.getURL()).hostname.toLowerCase() } catch { return }
    if (!host || (isLoopbackHost(host) && !c.blockOnDev) || inSet(host, new Set(c.allow))) return
    await wc.insertCSS(COSMETIC_CSS).catch(() => {})
    if (/(^|\.)youtube\.com$/.test(host)) await wc.executeJavaScript(YOUTUBE_SCRIPT).catch(() => {})
  }
}
