import { WebContentsView, type BrowserWindow, type Session, type WebContents } from 'electron'
import { MOBILE_USER_AGENT, computeLabLayout, type Device, type Rect } from '../shared/lab'

const SYNC_BINDING = '__izlix_sync'

// Lab betigi her viewport'a enjekte edilir: kaydirma, tiklama ve yazmayi ana surece bildirir; ana surec digerlerinde uygular.
// Uygulanan olaylar isTrusted=false oldugu icin geri yayilmaz; kaydirma icin kisa bir "replaying" kilidi kullanilir.
const LAB_SCRIPT = String.raw`(() => {
  if (window.__DB_LAB__) return; window.__DB_LAB__ = true;
  const emit = (o) => { try { window.${SYNC_BINDING}(JSON.stringify(o)); } catch (e) {} };
  let replaying = false, lock = null;
  const pathOf = (el) => {
    if (el.id && document.querySelectorAll('#' + CSS.escape(el.id)).length === 1) return '#' + CSS.escape(el.id);
    const parts = [];
    while (el && el.nodeType === 1 && el !== document.documentElement) {
      let i = 1, s = el; while ((s = s.previousElementSibling)) i++;
      parts.unshift(el.tagName.toLowerCase() + ':nth-child(' + i + ')'); el = el.parentElement;
    }
    return 'html > ' + parts.join(' > ');
  };
  addEventListener('scroll', (e) => {
    if (replaying || e.target !== document) return;
    const max = Math.max(1, document.documentElement.scrollHeight - innerHeight);
    emit({ t: 'scroll', y: scrollY / max });
  }, { passive: true, capture: true });
  addEventListener('click', (e) => { if (e.isTrusted && !replaying) emit({ t: 'click', p: pathOf(e.target) }); }, true);
  addEventListener('input', (e) => {
    const el = e.target;
    if (e.isTrusted && !replaying && el && 'value' in el) emit({ t: 'input', p: pathOf(el), v: String(el.value) });
  }, true);
  window.__DB_APPLY__ = (m) => {
    replaying = true; clearTimeout(lock); lock = setTimeout(() => { replaying = false; }, 150);
    try {
      if (m.t === 'scroll') scrollTo(0, m.y * Math.max(0, document.documentElement.scrollHeight - innerHeight));
      else {
        const el = document.querySelector(m.p); if (!el) return;
        if (m.t === 'click') { if (el.focus) el.focus(); el.click(); }
        else if (m.t === 'input') {
          const proto = el instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
          const set = Object.getOwnPropertyDescriptor(proto, 'value'); if (set && set.set) set.set.call(el, m.v); else el.value = m.v;
          el.dispatchEvent(new Event('input', { bubbles: true }));
        }
      }
    } catch (e) {}
  };
})();`

interface LView { device: Device; wc: WebContents; view: WebContentsView | null; scriptId?: string; scale?: number; onMsg: (_e: unknown, method: string, p: any) => void }

type SyncMsg = { t: 'scroll'; y: number } | { t: 'click'; p: string } | { t: 'input'; p: string; v: string }
function parseMsg(raw: unknown): SyncMsg | null {
  try {
    const m = JSON.parse(String(raw))
    if (m.t === 'scroll' && typeof m.y === 'number' && Number.isFinite(m.y)) return { t: 'scroll', y: Math.min(1, Math.max(0, m.y)) }
    if (m.t === 'click' && typeof m.p === 'string' && m.p.length < 2000) return { t: 'click', p: m.p }
    if (m.t === 'input' && typeof m.p === 'string' && m.p.length < 2000 && typeof m.v === 'string' && m.v.length < 100_000) return { t: 'input', p: m.p, v: m.v }
  } catch { /* gecersiz mesaj yok sayilir */ }
  return null
}

/** Bir sekmenin Responsive Lab durumu: birincil gorunum + en fazla 3 ek gorunum, hepsi ayni oturum bolumunde. */
export class Lab {
  private views: LView[] = []
  private visible = true
  private onNav: (() => void) | null = null
  private lastArea: Rect | null = null

  constructor(private win: BrowserWindow, private primary: WebContentsView, private ses: Session) {}

  get devices(): Device[] { return this.views.map((v) => v.device) }
  get extraViews(): WebContentsView[] { return this.views.flatMap((v) => (v.view ? [v.view] : [])) }

  private async setup(v: LView): Promise<void> {
    const dbg = v.wc.debugger
    if (!dbg.isAttached()) dbg.attach('1.3')
    dbg.on('message', v.onMsg)
    await dbg.sendCommand('Runtime.enable')
    await dbg.sendCommand('Page.enable') // addScriptToEvaluateOnNewDocument yeni belgelerde ancak Page etkinken guvenilir calisir
    await dbg.sendCommand('Runtime.addBinding', { name: SYNC_BINDING })
    v.scriptId = (await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: LAB_SCRIPT })).identifier
    await dbg.sendCommand('Runtime.evaluate', { expression: LAB_SCRIPT }).catch(() => {})
  }

  private async emulate(v: LView, scale: number): Promise<void> {
    if (v.scale === scale) return
    v.scale = scale
    const d = v.device, dbg = v.wc.debugger
    await dbg.sendCommand('Emulation.setDeviceMetricsOverride', { width: d.width, height: d.height, deviceScaleFactor: d.dpr, mobile: d.mobile, scale }).catch(() => {})
    await dbg.sendCommand('Emulation.setUserAgentOverride', { userAgent: d.mobile ? MOBILE_USER_AGENT : '' }).catch(() => {})
    await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: d.mobile }).catch(() => {})
    await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: d.mobile, configuration: 'mobile' }).catch(() => {})
  }

  private broadcast(from: LView, raw: unknown): void {
    const m = parseMsg(raw)
    if (!m) return
    for (const o of this.views) {
      if (o === from || o.wc.isDestroyed()) continue
      void o.wc.debugger.sendCommand('Runtime.evaluate', { expression: `window.__DB_APPLY__&&window.__DB_APPLY__(${JSON.stringify(m)})` }).catch(() => {})
    }
  }

  private makeView(device: Device, wc: WebContents, view: WebContentsView | null): LView {
    const v: LView = { device, wc, view, onMsg: () => {} }
    v.onMsg = (_e, method, p) => { if (method === 'Runtime.bindingCalled' && p.name === SYNC_BINDING) this.broadcast(v, p.payload) }
    return v
  }

  /** Cihaz listesini uygular: ilki birincil gorunum, digerleri yeni gorunumler. Mevcut ek gorunumler yeniden kurulur. */
  async setDevices(devices: Device[]): Promise<void> {
    await this.teardownExtras()
    const url = this.primary.webContents.getURL()
    if (!this.views.length) {
      const pv = this.makeView(devices[0], this.primary.webContents, null)
      this.views.push(pv)
      await this.setup(pv)
      this.onNav = () => {
        const u = this.primary.webContents.getURL()
        for (const o of this.views) if (o.view && !o.wc.isDestroyed() && o.wc.getURL() !== u) void o.wc.loadURL(u).catch(() => {})
      }
      this.primary.webContents.on('did-navigate', this.onNav)
    } else { this.views[0].device = devices[0]; this.views[0].scale = undefined }
    for (const d of devices.slice(1)) {
      const view = new WebContentsView({ webPreferences: { session: this.ses, sandbox: true, contextIsolation: true, nodeIntegration: false } })
      view.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
      if (this.visible) this.win.contentView.addChildView(view)
      const lv = this.makeView(d, view.webContents, view)
      this.views.push(lv)
      await view.webContents.loadURL('about:blank')
      await this.setup(lv)
      if (/^https?:/.test(url)) void view.webContents.loadURL(url).catch(() => {})
    }
    if (this.media.length) await this.applyMedia(this.media)
    if (this.lastArea) this.layout(this.lastArea)
  }

  layout(area: Rect): void {
    this.lastArea = area
    const slots = computeLabLayout(area, this.views.map((v) => v.device))
    this.views.forEach((v, i) => {
      const s = slots[i]
      if (!s) return
      ;(v.view ?? this.primary).setBounds(s)
      void this.emulate(v, s.scale)
    })
  }

  /** Medya emulasyonu (tema/hareket) Lab'daki TUM gorunumlere uygulanir */
  async applyMedia(features: { name: string; value: string }[]): Promise<void> {
    for (const v of this.views) if (!v.wc.isDestroyed()) await v.wc.debugger.sendCommand('Emulation.setEmulatedMedia', { features }).catch(() => {})
  }
  get mediaFeatures(): { name: string; value: string }[] { return this.media }
  media: { name: string; value: string }[] = []

  /** Lab'daki tum gorunumlerin webContents'i (emulasyonu hepsine uygulamak icin) */
  get webContents(): WebContents[] { return this.views.map((v) => v.wc).filter((w) => !w.isDestroyed()) }

  addViews(): void { if (this.visible) for (const v of this.extraViews) this.win.contentView.addChildView(v) }
  removeViews(): void { for (const v of this.extraViews) this.win.contentView.removeChildView(v) }
  setVisible(on: boolean): void { this.visible = on; for (const v of this.extraViews) v.setVisible(on) }

  private async teardownExtras(): Promise<void> {
    for (const v of this.views.filter((x) => x.view)) {
      try { v.wc.debugger.removeListener('message', v.onMsg); if (!v.wc.isDestroyed()) { try { v.wc.debugger.detach() } catch { /* kopmus */ } } } catch { /* yok say */ }
      this.win.contentView.removeChildView(v.view!)
      if (!v.wc.isDestroyed()) v.wc.close()
    }
    this.views = this.views.filter((x) => !x.view)
  }

  /** Lab'dan cik: ek gorunumleri kapat, birincil gorunumdeki emulasyonu ve betigi geri al. */
  async dispose(): Promise<void> {
    await this.teardownExtras()
    const pv = this.views[0]
    if (pv && !pv.wc.isDestroyed()) {
      if (this.onNav) pv.wc.removeListener('did-navigate', this.onNav)
      pv.wc.debugger.removeListener('message', pv.onMsg)
      const dbg = pv.wc.debugger
      await dbg.sendCommand('Emulation.clearDeviceMetricsOverride').catch(() => {})
      await dbg.sendCommand('Emulation.setUserAgentOverride', { userAgent: '' }).catch(() => {})
      await dbg.sendCommand('Emulation.setTouchEmulationEnabled', { enabled: false }).catch(() => {})
      await dbg.sendCommand('Emulation.setEmitTouchEventsForMouse', { enabled: false }).catch(() => {})
      if (pv.scriptId) await dbg.sendCommand('Page.removeScriptToEvaluateOnNewDocument', { identifier: pv.scriptId }).catch(() => {})
      await dbg.sendCommand('Runtime.evaluate', { expression: 'window.__DB_LAB__ = false' }).catch(() => {})
    }
    this.views = []
  }
}
