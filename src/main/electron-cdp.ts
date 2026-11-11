import type { WebContents } from 'electron'
import type { CdpClient } from '../core/cdp-client'

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
