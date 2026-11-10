import type { WebContents } from 'electron'

/**
 * Elements ve Storage panelleri icin CDP koprusu. Yalnizca izin listesindeki yontemler cagrilabilir; alanlar (DOM/CSS/Overlay/DOMStorage)
 * yalnizca panel acikken etkinlestirilir ("sayfayi gozlemle, bozma"). Sayfa tarafi bu kanala hic erisemez; cagiran yalnizca shell'dir.
 */
export const ALLOWED_METHODS = new Set([
  'DOM.getDocument', 'DOM.requestChildNodes', 'DOM.describeNode', 'DOM.getBoxModel', 'DOM.resolveNode', 'DOM.pushNodesByBackendIdsToFrontend', 'DOM.getOuterHTML',
  'DOM.setAttributeValue', 'DOM.removeAttribute', 'DOM.removeNode', 'DOM.setNodeValue', 'DOM.setOuterHTML', 'DOM.querySelector', 'DOM.getAttributes',
  'CSS.getComputedStyleForNode', 'CSS.getMatchedStylesForNode', 'CSS.getInlineStylesForNode',
  'Overlay.highlightNode', 'Overlay.hideHighlight', 'Overlay.setInspectMode',
  'Performance.getMetrics', 'Profiler.startPreciseCoverage', 'Profiler.takePreciseCoverage', 'Profiler.stopPreciseCoverage', 'CSS.startRuleUsageTracking', 'CSS.stopRuleUsageTracking', 'CSS.getStyleSheetText', 'DOMStorage.getDOMStorageItems', 'DOMStorage.setDOMStorageItem', 'DOMStorage.removeDOMStorageItem', 'DOMStorage.clear',
  'Network.getCookies', 'Network.setCookie', 'Network.deleteCookies',
  'Storage.getStorageKeyForFrame', 'Page.getFrameTree', 'IndexedDB.requestDatabaseNames', 'IndexedDB.requestDatabase', 'IndexedDB.deleteDatabase',
  'CacheStorage.requestCacheNames', 'CacheStorage.requestEntries', 'CacheStorage.deleteCache', 'CacheStorage.deleteEntry'
])

export type Feature = 'elements' | 'storage' | 'perf' | 'coverage'
const ENABLE: Record<Feature, string[]> = { elements: ['DOM.enable', 'CSS.enable', 'Overlay.enable'], storage: ['DOMStorage.enable', 'IndexedDB.enable'], perf: ['Performance.enable'], coverage: ['Profiler.enable', 'DOM.enable', 'CSS.enable'] }
const DISABLE: Record<Feature, string[]> = { elements: ['Overlay.setInspectMode', 'Overlay.disable', 'CSS.disable', 'DOM.disable'], storage: ['IndexedDB.disable', 'DOMStorage.disable'], perf: ['Performance.disable'], coverage: ['CSS.disable', 'DOM.disable', 'Profiler.disable'] }

/** Panel acikken shell'e aktarilan olaylar */
export const FORWARDED_EVENTS = /^(DOM\.(documentUpdated|childNodeInserted|childNodeRemoved|attributeModified|attributeRemoved|characterDataModified|childNodeCountUpdated|setChildNodes)|Overlay\.inspectNodeRequested|DOMStorage\.domStorageItem(Added|Removed|Updated)|DOMStorage\.domStorageItemsCleared)$/

export const isAllowedMethod = (m: string): boolean => ALLOWED_METHODS.has(m)

/** Sayfadaki bir DOM dugumunun en yakin React bilesen zinciri (fiber `return` yolu) */
export const REACT_CHAIN_FN = `function () {
  const el = this; const key = Object.keys(el).find((k) => k.startsWith('__reactFiber$') || k.startsWith('__reactInternalInstance$'));
  if (!key) return null;
  let f = el[key]; const out = [];
  while (f && out.length < 10) {
    if ([0, 1, 11, 14, 15].indexOf(f.tag) !== -1) {
      const t = f.type, e = f.elementType;
      const fn = typeof t === 'function' ? t : t && (t.render || t.type) ;
      const name = (t && t.displayName) || (fn && (fn.displayName || fn.name)) || 'Anonymous';
      let src;
      for (const c of [t, t && t.type, t && t.render, e, e && e.type]) { if (c && typeof c.__izlix_src === 'string') { src = c.__izlix_src; break; } }
      out.push({ name: name, src: src });
    }
    f = f.return;
  }
  return out;
}`

export class CdpProxy {
  private active = new Map<string, Set<Feature>>()
  private listeners = new Map<string, (_e: unknown, method: string, params: any) => void>()

  constructor(private getWc: (tabId: string) => WebContents | null, private emit: (tabId: string, method: string, params: unknown) => void) {}

  private wc(tabId: string): WebContents | null { const w = this.getWc(tabId); return w && !w.isDestroyed() ? w : null }

  async call(tabId: string, method: string, params?: object): Promise<unknown> {
    if (!isAllowedMethod(method)) throw new Error(`izinli olmayan CDP yontemi: ${method}`)
    const w = this.wc(tabId)
    if (!w) return null
    return w.debugger.sendCommand(method, params ?? {})
  }

  async enable(tabId: string, f: Feature): Promise<void> {
    const w = this.wc(tabId)
    if (!w) return
    const set = this.active.get(tabId) ?? new Set<Feature>()
    if (set.has(f)) return
    set.add(f); this.active.set(tabId, set)
    if (!this.listeners.has(tabId)) {
      const l = (_e: unknown, method: string, params: any): void => { if (FORWARDED_EVENTS.test(method)) this.emit(tabId, method, params) }
      this.listeners.set(tabId, l); w.debugger.on('message', l)
    }
    for (const m of ENABLE[f]) await w.debugger.sendCommand(m).catch(() => {})
  }

  async disable(tabId: string, f: Feature): Promise<void> {
    const set = this.active.get(tabId)
    if (!set?.has(f)) return
    set.delete(f)
    const w = this.wc(tabId)
    if (w) for (const m of DISABLE[f]) await w.debugger.sendCommand(m, m === 'Overlay.setInspectMode' ? { mode: 'none', highlightConfig: {} } : {}).catch(() => {})
    if (!set.size) this.release(tabId)
  }

  private release(tabId: string): void {
    const l = this.listeners.get(tabId); const w = this.wc(tabId)
    if (l && w) w.debugger.removeListener('message', l)
    this.listeners.delete(tabId); this.active.delete(tabId)
  }

  /** sekme kapanirken */
  drop(tabId: string): void { this.release(tabId) }

  /** DOM dugumu -> en yakin React bileseninin Inspector agac indeksi (Pick) */
  async reactIndex(tabId: string, nodeId: number): Promise<{ id: number; name: string } | null> {
    const w = this.wc(tabId)
    if (!w) return null
    try {
      const r: any = await w.debugger.sendCommand('DOM.resolveNode', { nodeId })
      const objectId = r.object?.objectId
      if (!objectId) return null
      const res: any = await w.debugger.sendCommand('Runtime.callFunctionOn', { objectId, functionDeclaration: 'function () { return window.__IZLIX_INDEX_OF__ ? window.__IZLIX_INDEX_OF__(this) : null }', returnByValue: true })
      void w.debugger.sendCommand('Runtime.releaseObject', { objectId }).catch(() => {})
      return res.result?.value ?? null
    } catch { return null }
  }

  /** React bilesen zinciri: DOM dugumu -> fiber -> bilesen adlari */
  async reactChain(tabId: string, nodeId: number): Promise<{ name: string; src?: string }[] | null> {
    const w = this.wc(tabId)
    if (!w) return null
    try {
      const r: any = await w.debugger.sendCommand('DOM.resolveNode', { nodeId })
      const objectId = r.object?.objectId
      if (!objectId) return null
      const res: any = await w.debugger.sendCommand('Runtime.callFunctionOn', { objectId, functionDeclaration: REACT_CHAIN_FN, returnByValue: true })
      void w.debugger.sendCommand('Runtime.releaseObject', { objectId }).catch(() => {})
      return res.result?.value ?? null
    } catch { return null }
  }
}
