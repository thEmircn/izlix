import type { WebContents } from 'electron'
import type { EventBus } from './bus'
import { changedKeys, STATE_BINDING, STATE_SCRIPT } from '../shared/statebridge'

const MAX_PAYLOAD = 200_000

/** Durum koprusu (ana surec): sayfadaki Redux DevTools taklidinden gelen eylemleri 'state' olayina cevirir, girdi/yanita (tahmini) baglar. */
export class StateBridge {
  private last = new Map<string, unknown>()
  constructor(private bus: EventBus) {}

  async attach(wc: WebContents, tabId: string): Promise<void> {
    if (wc.isDestroyed()) return
    await wc.debugger.sendCommand('Runtime.addBinding', { name: STATE_BINDING }).catch(() => {})
    await wc.debugger.sendCommand('Page.enable').catch(() => {})
    await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: STATE_SCRIPT }).catch(() => {})
    wc.debugger.on('message', (_e, method, p: { name?: string; payload?: string }) => {
      if (method === 'Runtime.bindingCalled' && p.name === STATE_BINDING && typeof p.payload === 'string' && p.payload.length < MAX_PAYLOAD) this.onCall(tabId, p.payload)
    })
  }

  private onCall(tabId: string, payload: string): void {
    let m: { t?: string; store?: string; action?: string; state?: unknown; payload?: unknown }
    try { m = JSON.parse(payload) } catch { return }
    if ((m.t !== 'init' && m.t !== 'action') || typeof m.store !== 'string' || m.store.length > 80) return
    const key = `${tabId}|${m.store}`, prev = this.last.get(key)
    const changed = m.t === 'init' ? Object.keys((m.state && typeof m.state === 'object' ? m.state : {}) as object) : changedKeys(prev, m.state)
    this.last.set(key, m.state)
    const action = m.t === 'init' ? '@init' : String(m.action ?? 'action').slice(0, 120)
    const ev = this.bus.emit({ tabId, kind: 'state', source: 'store:devtools', payload: { name: `${m.store}: ${action}`, store: m.store, action, changed, state: m.state, actionPayload: m.payload } })
    // nedensellik: son girdi (<=800 ms) ve son yanit (<=400 ms) -> tahmini bag
    const recent = this.bus.snapshot(tabId).slice(-80)
    const input = [...recent].reverse().find((e) => e.kind === 'input' && ev.ts - e.ts >= 0 && ev.ts - e.ts <= 800)
    const resp = [...recent].reverse().find((e) => e.kind === 'response' && ev.ts - e.ts >= 0 && ev.ts - e.ts <= 400)
    if (input) this.bus.link(ev.id, input.id, 'estimated', 'input→state')
    else if (resp) this.bus.link(ev.id, resp.id, 'estimated', 'response→state')
  }
  drop(tabId: string): void { for (const k of [...this.last.keys()]) if (k.startsWith(`${tabId}|`)) this.last.delete(k) }
}
