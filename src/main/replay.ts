import type { WebContents } from 'electron'
import { findScript, selectScript, type Step } from '../shared/recorder'

export type StepState = 'run' | 'ok' | 'fail' | 'skip'
export interface ReplayResult { ok: number; fail: number; skipped: number; error?: string }
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

/** Recorder akisini sayfada oynatir: gercek (guvenilir) fare/klavye olaylariyla; her adimda ogeyi bekler (varsayilan 5 sn). Sifre adimlari atlanir. */
export class Replayer {
  private cancelFlag = false
  running = false
  cancel(): void { this.cancelFlag = true }

  async run(wc: WebContents, steps: Step[], onStep: (i: number, s: StepState, err?: string) => void, timeoutMs = 5000): Promise<ReplayResult> {
    if (this.running) return { ok: 0, fail: 0, skipped: 0, error: 'busy' }
    this.running = true; this.cancelFlag = false
    const res: ReplayResult = { ok: 0, fail: 0, skipped: 0 }
    try {
      for (let i = 0; i < steps.length; i++) {
        if (this.cancelFlag || wc.isDestroyed()) { res.error = 'cancelled'; break }
        const s = steps[i]
        if (s.t === 'fill' && s.secret) { onStep(i, 'skip', 'password'); res.skipped++; continue }
        onStep(i, 'run')
        try { await this.exec(wc, s, timeoutMs); onStep(i, 'ok'); res.ok++ }
        catch (e) { const msg = String((e as Error).message ?? e); onStep(i, 'fail', msg); res.fail++; res.error = msg; break } // ilk hatada dur
      }
    } finally { this.running = false }
    return res
  }

  private async find(wc: WebContents, sel: Step extends infer S ? (S extends { sel: infer X } ? X : never) : never, timeoutMs: number): Promise<{ x: number; y: number }> {
    const t0 = Date.now()
    for (;;) {
      const r = await wc.executeJavaScript(findScript(sel as never)).catch(() => null) as { x: number; y: number } | null
      if (r) return r
      if (Date.now() - t0 > timeoutMs) throw new Error('element not found')
      await sleep(150)
    }
  }
  private async settle(wc: WebContents): Promise<void> {
    await sleep(250)
    const t0 = Date.now()
    while (!wc.isDestroyed() && wc.isLoading() && Date.now() - t0 < 8000) await sleep(100)
  }
  private async click(wc: WebContents, x: number, y: number): Promise<void> {
    wc.sendInputEvent({ type: 'mouseMove', x, y }); wc.sendInputEvent({ type: 'mouseDown', x, y, button: 'left', clickCount: 1 }); wc.sendInputEvent({ type: 'mouseUp', x, y, button: 'left', clickCount: 1 })
  }

  private async exec(wc: WebContents, s: Step, timeoutMs: number): Promise<void> {
    switch (s.t) {
      case 'goto': {
        if (!/^https?:\/\//i.test(s.url)) throw new Error('bad url')
        await wc.loadURL(s.url).catch(() => {}); await this.settle(wc); return
      }
      case 'click': { const p = await this.find(wc, s.sel, timeoutMs); await this.click(wc, p.x, p.y); await this.settle(wc); return }
      case 'fill': {
        const p = await this.find(wc, s.sel, timeoutMs); await this.click(wc, p.x, p.y); await sleep(80)
        await wc.executeJavaScript('(() => { const a = document.activeElement; if (a && a.select) a.select() })()').catch(() => {})
        if (s.value) wc.insertText(s.value); else wc.sendInputEvent({ type: 'keyDown', keyCode: 'Backspace' })
        await sleep(120); return
      }
      case 'select': { const p = await this.find(wc, s.sel, timeoutMs); void p; if (!(await wc.executeJavaScript(selectScript(s.sel, s.value)))) throw new Error('select failed'); await sleep(120); return }
      case 'press': {
        const p = await this.find(wc, s.sel, timeoutMs); await this.click(wc, p.x, p.y); await sleep(60)
        wc.sendInputEvent({ type: 'keyDown', keyCode: s.key }); wc.sendInputEvent({ type: 'keyUp', keyCode: s.key }); await this.settle(wc); return
      }
    }
  }
}
