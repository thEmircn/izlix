import type { WebContents } from 'electron'
import { REC_BINDING, REC_SCRIPT, type Sel, type Step } from '../shared/recorder'

const MAX_STEPS = 500
const str = (v: unknown, n: number): string | null => (typeof v === 'string' && v.length <= n ? v : null)

/** Sayfadan gelen adimi dogrular (sayfa guvenilmez veri kaynagidir): bilinen turler, sinirli uzunluk */
export function parseStep(raw: unknown): Step | null {
  if (!raw || typeof raw !== 'object') return null
  const o = raw as Record<string, unknown>
  const parseSel = (s: unknown): Sel | null => {
    if (!s || typeof s !== 'object') return null
    const x = s as Record<string, unknown>
    if (x.k === 'role') { const role = str(x.role, 40), name = str(x.name, 120); return role && name ? { k: 'role', role, name } : null }
    if (x.k === 'testid' || x.k === 'placeholder' || x.k === 'label' || x.k === 'text' || x.k === 'css') { const v = str(x.v, 300); return v ? { k: x.k, v } : null }
    return null
  }
  const sel = parseSel(o.sel); if (!sel) return null
  switch (o.t) {
    case 'click': return { t: 'click', sel }
    case 'fill': { const value = str(o.value, 2000); return value === null ? null : { t: 'fill', sel, value: o.secret ? '' : value, ...(o.secret ? { secret: true } : {}) } }
    case 'select': { const value = str(o.value, 500); return value === null ? null : { t: 'select', sel, value } }
    case 'press': { const key = str(o.key, 20); return key && ['Enter', 'Escape', 'Tab'].includes(key) ? { t: 'press', sel, key } : null }
    default: return null
  }
}

interface Session { steps: Step[]; tabId: string; scriptId: string | null; onMsg: (e: unknown, m: string, p: { name?: string; payload?: string }) => void; onNav: (e: unknown, url: string) => void; lastAction: number }

/** Akis kaydedici: CDP binding + belge-basi betik; adimlari toplar, durdurunca doner. */
export class Recorder {
  private s = new Map<number, Session>()
  constructor(private push: (state: { recording: boolean; tabId: string | null; steps: Step[] }) => void) {}

  active(): { tabId: string; steps: Step[] } | null { const x = [...this.s.values()][0]; return x ? { tabId: x.tabId, steps: x.steps } : null }
  private emit(): void { const a = this.active(); this.push({ recording: !!a, tabId: a?.tabId ?? null, steps: a?.steps ?? [] }) }

  async start(wc: WebContents, tabId: string): Promise<boolean> {
    if (wc.isDestroyed() || this.s.has(wc.id) || this.s.size > 0) return false
    const dbg = wc.debugger
    await dbg.sendCommand('Runtime.addBinding', { name: REC_BINDING }).catch(() => {})
    await dbg.sendCommand('Page.enable').catch(() => {})
    const r = await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: REC_SCRIPT }).catch(() => null)
    const sess: Session = { steps: [], tabId, scriptId: r?.identifier ?? null, lastAction: 0,
      onMsg: (_e, m, p) => {
        if (m !== 'Runtime.bindingCalled' || p.name !== REC_BINDING || typeof p.payload !== 'string' || p.payload.length > 6000) return
        let step: Step | null = null
        try { step = parseStep(JSON.parse(p.payload)) } catch { return }
        if (step && sess.steps.length < MAX_STEPS) { sess.steps.push(step); sess.lastAction = Date.now(); this.emit() }
      },
      onNav: (_e, url) => {
        // tiklama/Enter sonrasi gelen gezinme akisin dogal sonucu: ayrica kaydetme
        if (!/^https?:/.test(url) || Date.now() - sess.lastAction < 2500 || sess.steps.length >= MAX_STEPS) return
        sess.steps.push({ t: 'goto', url }); this.emit()
      } }
    this.s.set(wc.id, sess)
    dbg.on('message', sess.onMsg); wc.on('did-navigate', sess.onNav)
    const url = wc.getURL(); if (/^https?:/.test(url)) sess.steps.push({ t: 'goto', url })
    await wc.executeJavaScript(REC_SCRIPT).catch(() => {})
    this.emit(); return true
  }

  async stop(wc: WebContents): Promise<Step[]> {
    const sess = this.s.get(wc.id); if (!sess) return []
    this.s.delete(wc.id)
    if (!wc.isDestroyed()) {
      wc.debugger.removeListener('message', sess.onMsg); wc.removeListener('did-navigate', sess.onNav)
      if (sess.scriptId) await wc.debugger.sendCommand('Page.removeScriptToEvaluateOnNewDocument', { identifier: sess.scriptId }).catch(() => {})
    }
    this.emit(); return sess.steps
  }
}
