import type { WebContents } from 'electron'
import type { SourceResolver } from './sources'
import { formatEval, preview } from './evalformat'

export interface DbgFrame { id: string; fn: string; url: string; line: number; col: number; orig?: { file: string; line: number }; scopes: { type: string; name?: string; objectId?: string }[] }
export type DbgEvent =
  | { type: 'paused'; reason: string; frames: DbgFrame[]; hit: string[] }
  | { type: 'resumed' }
export interface ScopeVar { name: string; text: string; type: string; objectId?: string }

const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
/** Sorgu dizesi hariclenerek URL eslestiren duzenli ifade (HMR `?t=` degisse de kesme noktasi tutar) */
export const urlRegexFor = (url: string): string => `^${escapeRe(url.split('?')[0].split('#')[0])}(\\?.*)?$`

/** Panel acikken Debugger alanini etkinlestirir; kesme noktasi, duraklatma/adimlama, cagri yigini ve kapsam degiskenleri. */
export class DebuggerService {
  private active = new Map<string, (_e: unknown, method: string, p: any) => void>()
  /** scriptId -> url (Debugger.scriptParsed); duraklamada callFrame.url bos gelebilir */
  private scriptUrls = new Map<string, Map<string, string>>()

  constructor(private getTab: (id: string) => { wc: WebContents; resolver?: SourceResolver } | null, private emit: (tabId: string, e: DbgEvent) => void) {}

  private wc(tabId: string): WebContents | null { const t = this.getTab(tabId); return t && !t.wc.isDestroyed() ? t.wc : null }

  async enable(tabId: string): Promise<boolean> {
    const t = this.getTab(tabId)
    if (!t || t.wc.isDestroyed() || this.active.has(tabId)) return !!t
    if (t.resolver) t.resolver.holdDebugger = true
    const onMsg = (_e: unknown, method: string, p: any): void => {
      if (method === 'Debugger.scriptParsed') { let m = this.scriptUrls.get(tabId); if (!m) this.scriptUrls.set(tabId, (m = new Map())); if (p.url) m.set(p.scriptId, p.url) }
      else if (method === 'Debugger.paused') void this.onPaused(tabId, p)
      else if (method === 'Debugger.resumed') this.emit(tabId, { type: 'resumed' })
    }
    this.active.set(tabId, onMsg); t.wc.debugger.on('message', onMsg)
    await t.wc.debugger.sendCommand('Debugger.enable').catch(() => {})
    await t.wc.debugger.sendCommand('Debugger.setAsyncCallStackDepth', { maxDepth: 16 }).catch(() => {})
    return true
  }

  async disable(tabId: string): Promise<void> {
    const t = this.getTab(tabId); const l = this.active.get(tabId)
    if (!l) return
    this.active.delete(tabId); this.scriptUrls.delete(tabId)
    if (t && !t.wc.isDestroyed()) {
      t.wc.debugger.removeListener('message', l)
      await t.wc.debugger.sendCommand('Debugger.setPauseOnExceptions', { state: 'none' }).catch(() => {})
      await t.wc.debugger.sendCommand('Debugger.resume').catch(() => {})
      await t.wc.debugger.sendCommand('Debugger.disable').catch(() => {})
    }
    if (t?.resolver) t.resolver.holdDebugger = false
  }
  drop(tabId: string): void { const l = this.active.get(tabId); const w = this.wc(tabId); if (l && w) w.debugger.removeListener('message', l); this.active.delete(tabId) }

  private async onPaused(tabId: string, p: any): Promise<void> {
    const t = this.getTab(tabId)
    const frames: DbgFrame[] = []
    for (const f of (p.callFrames ?? []).slice(0, 40)) {
      const loc = f.location
      const url: string = f.url || this.scriptUrls.get(tabId)?.get(loc.scriptId) || ''
      const orig = t?.resolver ? await t.resolver.resolveFrame(loc.scriptId, loc.lineNumber, loc.columnNumber ?? 0, url).catch(() => null) : null
      frames.push({
        id: f.callFrameId, fn: f.functionName || '(anonymous)', url, line: loc.lineNumber + 1, col: (loc.columnNumber ?? 0) + 1,
        orig: orig ? { file: orig.file, line: orig.line } : undefined,
        scopes: (f.scopeChain ?? []).filter((s: any) => s.type !== 'global').slice(0, 6).map((s: any) => ({ type: s.type, name: s.name, objectId: s.object?.objectId }))
      })
    }
    const hit: string[] = p.hitBreakpoints ?? []
    this.emit(tabId, { type: 'paused', reason: hit.length ? 'breakpoint' : String(p.reason ?? 'other'), frames, hit })
  }

  /** Kesme noktasi: `url` (uretilen betik) veya `file` (orijinal kaynak; source map ile cevrilir). line 1-bazli. */
  async setBreakpoint(tabId: string, a: { url?: string; file?: string; line: number; condition?: string }): Promise<{ id: string; url: string; line: number } | { error: string }> {
    const t = this.getTab(tabId); const w = this.wc(tabId)
    if (!t || !w) return { error: 'no page' }
    let url = a.url, line0 = a.line - 1, col0 = 0
    if (!url && a.file) {
      const g = t.resolver ? await t.resolver.generatedFor(a.file, a.line, 0) : null
      if (!g) return { error: 'unmapped' }
      url = g.url; line0 = g.line0; col0 = g.col0
    }
    if (!url) return { error: 'no url' }
    try {
      const r: any = await w.debugger.sendCommand('Debugger.setBreakpointByUrl', { lineNumber: line0, urlRegex: urlRegexFor(url), columnNumber: col0, ...(a.condition ? { condition: a.condition } : {}) })
      return { id: r.breakpointId, url, line: line0 + 1 }
    } catch (e) { return { error: String((e as Error).message ?? e) } }
  }
  async removeBreakpoint(tabId: string, id: string): Promise<void> { await this.wc(tabId)?.debugger.sendCommand('Debugger.removeBreakpoint', { breakpointId: id }).catch(() => {}) }

  async control(tabId: string, cmd: 'resume' | 'stepOver' | 'stepInto' | 'stepOut' | 'pause'): Promise<void> {
    const m = { resume: 'Debugger.resume', stepOver: 'Debugger.stepOver', stepInto: 'Debugger.stepInto', stepOut: 'Debugger.stepOut', pause: 'Debugger.pause' }[cmd]
    await this.wc(tabId)?.debugger.sendCommand(m).catch(() => {})
  }
  async setExceptions(tabId: string, state: 'none' | 'uncaught' | 'all'): Promise<void> { await this.wc(tabId)?.debugger.sendCommand('Debugger.setPauseOnExceptions', { state }).catch(() => {}) }

  async scope(tabId: string, objectId: string): Promise<ScopeVar[]> {
    const w = this.wc(tabId); if (!w) return []
    try {
      const r: any = await w.debugger.sendCommand('Runtime.getProperties', { objectId, ownProperties: true, generatePreview: true })
      return (r.result ?? []).filter((x: any) => x.value && x.name !== '__proto__' && !/^Symbol\(/.test(x.name)).slice(0, 80)
        .map((x: any) => ({ name: x.name, text: preview(x.value), type: x.value.subtype ?? x.value.type, objectId: x.value.objectId && x.value.type === 'object' ? x.value.objectId : undefined }))
    } catch { return [] }
  }

  async evalOnFrame(tabId: string, frameId: string, expression: string): Promise<{ ok: boolean; text: string }> {
    const w = this.wc(tabId); if (!w) return { ok: false, text: 'no page' }
    try { return formatEval(await w.debugger.sendCommand('Debugger.evaluateOnCallFrame', { callFrameId: frameId, expression, generatePreview: true, includeCommandLineAPI: true })) } catch (e) { return { ok: false, text: String((e as Error).message ?? e) } }
  }
}
