import type { CdpClient } from '../../../src/core/cdp-client'

/** chrome.debugger olaylarini sekme bazinda dagitir (tek global dinleyici) */
const listeners = new Map<number, Set<(method: string, params: any) => void>>()
let wired = false
function wire(): void {
  if (wired) return; wired = true
  chrome.debugger.onEvent.addListener((src, method, params) => { if (src.tabId != null) listeners.get(src.tabId)?.forEach((fn) => fn(method, params)) })
}

/** Sekmeye chrome.debugger ile baglanir ve ortak CdpClient arayuzunu verir (cekirdek Electron'daki ile ayni kodu calistirir) */
export async function chromeCdp(tabId: number): Promise<CdpClient> {
  wire()
  await chrome.debugger.attach({ tabId }, '1.3')
  const set = listeners.get(tabId) ?? new Set(); listeners.set(tabId, set)
  return {
    send: (method, params) => chrome.debugger.sendCommand({ tabId }, method, params ?? {}),
    onEvent: (fn) => { set.add(fn); return () => { set.delete(fn) } },
    detach: () => { set.clear(); listeners.delete(tabId); void chrome.debugger.detach({ tabId }).catch(() => {}) }
  }
}
export const isAttached = async (tabId: number): Promise<boolean> => (await chrome.debugger.getTargets()).some((t) => t.tabId === tabId && t.attached)
