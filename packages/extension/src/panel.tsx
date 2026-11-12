import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import '../../../src/renderer/styles.css'
import type { BusEvent } from '../../../src/shared/events'
import { useStore } from '../../../src/renderer/store'
import { Timeline } from '../../../src/renderer/Timeline'
import { Button, Dialog, Field, Segmented } from '../../../packages/ui/src'

/** Panel bir uzantidir: kabuk API'sinin (window.izlix) yalnizca gereken kismi gercek, gerisi guvenli no-op. */
// test/tanilama: yakalanmamis hatalari say
const errs: string[] = []; (window as any).__izlixErrors = errs
addEventListener('error', (e) => errs.push(String(e.message))); addEventListener('unhandledrejection', (e) => errs.push(String((e as PromiseRejectionEvent).reason)))
const fixedTab = Number(new URLSearchParams(location.search).get('tabId')) || null
let tabId = fixedTab ?? 0
let KEY = `tab-${tabId}`
const port = chrome.runtime.connect({ name: 'izlix-panel' })
const evSubs = new Set<(e: BusEvent) => void>()
const dtSubs = new Set<(e: { id: string; method: string; params: unknown }) => void>()
let snapshotResolve: ((l: BusEvent[]) => void) | null = null
let snapshotCache: BusEvent[] | null = null
const pending = new Map<number, (v: unknown) => void>(); let rpcSeq = 0
const rpc = (name: string, ...args: unknown[]): Promise<any> => new Promise((res) => { const id = ++rpcSeq; pending.set(id, res); port.postMessage({ t: 'rpc', id, name, args }) })
port.onMessage.addListener((m: any) => {
  if (m.t === 'events') { snapshotCache = m.events; snapshotResolve?.(m.events); snapshotResolve = null; if (m.tabId === tabId) useStore.getState().reset(m.events) }
  else if (m.t === 'update') useStore.setState({ updateNotice: m.notice } as any)
  else if (m.t === 'detached' && m.tabId === tabId) useStore.setState({ detached: m.reason } as any)
  else if (m.t === 'attach-error') useStore.setState({ attachError: m.message } as any)
  else if (m.t === 'dt') dtSubs.forEach((fn) => fn({ id: m.id, method: m.method, params: m.params }))
  else if (m.t === 'ev') evSubs.forEach((fn) => fn(m.e))
  else if (m.t === 'rules') useStore.setState((s) => ({ rules: { ...s.rules, default: m.cfg } }))
  else if (m.t === 'rpc') { pending.get(m.id)?.(m.value); pending.delete(m.id) }
})
/** izlenecek sekmeyi sec: sabit (?tabId=) ya da gercek kenar panelinde etkin sekme (sekme degisince takip eder) */
function follow(id: number): void {
  if (!id || id === tabId && snapshotCache) return
  tabId = id; KEY = `tab-${id}`; snapshotCache = null
  useStore.setState({ attachError: undefined, detached: undefined } as any)
  useStore.setState({ activeTabId: KEY, tabs: [{ id: KEY, workspaceId: 'default', title: '', url: '', loading: false, canGoBack: false, canGoForward: false } as any] })
  port.postMessage({ t: 'hello', tabId: id })
}
if (fixedTab) follow(fixedTab)
else {
  void chrome.tabs.query({ active: true, currentWindow: true }).then(([t]) => { if (t?.id) follow(t.id) })
  chrome.tabs.onActivated.addListener((a) => follow(a.tabId))
}

const lang = navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'
const real: Record<string, (...a: any[]) => any> = {
  snapshot: () => (snapshotCache ? Promise.resolve(snapshotCache) : new Promise<BusEvent[]>((r) => { snapshotResolve = r })),
  onEvent: (cb: (e: BusEvent) => void) => { evSubs.add(cb); return () => evSubs.delete(cb) },
  onUpdate: () => () => {}, // guncellemeler de 'ev' mesajiyla gelir (onEvent ayni dinleyiciye gider)
  getSettings: () => Promise.resolve({ language: lang, onboarded: true, telemetry: 'denied' }),
  track: () => Promise.resolve(),
  setRules: (wsId: string, cfg: unknown) => rpc('setRules', wsId, cfg),
  responseBody: (id: string, requestId: string) => rpc('responseBody', id, requestId),
  dt: (id: string, method: string, params?: unknown) => rpc('dtCall', id, method, params),
  a11yAudit: (id: string) => rpc('audit', id, 'a11y'),
  seoAudit: (id: string) => rpc('audit', id, 'seo'),
  imageAudit: (id: string) => rpc('audit', id, 'images'),
  linkCheck: (id: string) => rpc('audit', id, 'links'),
  reload: (id: string) => rpc('reload', id),
  cssSnapshot: (id: string) => rpc('cssSnap', id),
  dtEnable: (id: string, f: string) => rpc('dtEnable', id, f),
  dtDisable: (id: string, f: string) => rpc('dtDisable', id, f),
  dtReact: (id: string, nodeId: number) => rpc('dtReact', id, nodeId),
  dtReactIndex: (id: string, nodeId: number) => rpc('dtReactIdx', id, nodeId),
  onDt: (cb: (e: { id: string; method: string; params: unknown }) => void) => { dtSubs.add(cb); return () => dtSubs.delete(cb) },
  openSource: (t: { file: string; line: number; column?: number; editor?: string }) => rpc('openSource', t)
}
;(window as any).izlix = new Proxy(real, { get: (t, p: string) => t[p] ?? ((...a: any[]) => (p.startsWith('on') ? () => {} : Promise.resolve(null))) })

useStore.setState({
  allowedPanels: ['timeline', 'raw', 'network', 'console', 'renders', 'elements', 'storage', 'perf', 'coverage', 'profiler', 'a11y', 'seo'], // olay verisiyle calisan paneller (diger paneller ilerleyen surumlerde)
  activeTabId: KEY, panelOpen: true, panelTab: 'timeline', activeWorkspaceId: 'default',
  settings: { ...useStore.getState().settings, language: lang, onboarded: true } as any,
  tabs: [{ id: KEY, workspaceId: 'default', title: '', url: '', loading: false, canGoBack: false, canGoForward: false } as any]
})

void rpc('getRules').then((cfg) => useStore.setState((s) => ({ rules: { ...s.rules, default: cfg } })))

/** Izleme baslamadi (chrome:// sayfalari vb.) ya da kullanici Chrome'un hata ayiklama seridini kapatti */
function StatusBanner() {
  const err = (useStore as any)((s: any) => s.attachError) as string | undefined
  const det = (useStore as any)((s: any) => s.detached) as string | undefined
  const st = { err, det }
  const tr = lang === 'tr'
  if (!st.err && !st.det) return null
  const text = st.err
    ? (tr ? 'Bu sayfa incelenemiyor (chrome:// ve Web Store sayfalarına izin yok). Normal bir sayfa açın.' : 'This page cannot be inspected (chrome:// pages and the Web Store are not allowed). Open a normal page.')
    : (tr ? 'İzleme durduruldu.' : 'Tracing stopped.')
  return (
    <div role="alert" style={{ position: 'fixed', left: 12, right: 12, top: 12, zIndex: 25, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--g-brd2)', background: 'var(--panel)', boxShadow: 'var(--shadow-s)', fontSize: 12 }}>
      <span style={{ flex: 1 }}>{text}</span>
      {st.det && <button className="btn sm primary" onClick={() => void rpc('resume', tabId).then((ok) => { if (ok) useStore.setState({ detached: undefined } as any) })}>{tr ? 'Devam' : 'Resume'}</button>}
    </div>
  )
}

/** Ayarlar: proje klasoru (kok-goreli kaynak yollari icin) ve editor */
function SettingsButton() {
  const [open, setOpen] = useState(false), [root, setRoot] = useState(''), [editor, setEditor] = useState<'vscode' | 'cursor' | 'webstorm'>('vscode'), [msg, setMsg] = useState('')
  const tr = lang === 'tr'
  useEffect(() => { if (open) void rpc('getPrefs').then((p: any) => { setRoot(p.root); setEditor(p.editor); setMsg('') }) }, [open])
  const save = (): void => { void rpc('setPrefs', { root, editor }).then((p: any) => { setRoot(p.root); setMsg(root.trim() && !p.root ? (tr ? 'Klasör mutlak bir yol olmalı.' : 'The folder must be an absolute path.') : (tr ? 'Kaydedildi.' : 'Saved.')) }) }
  return (
    <>
      <button type="button" aria-label={tr ? 'Ayarlar' : 'Settings'} data-testid="ext-settings" onClick={() => setOpen(true)} style={{ position: 'fixed', left: 14, bottom: 24, zIndex: 20, width: 34, height: 34, borderRadius: 11, border: '1px solid var(--g-brd)', background: 'var(--panel)', color: 'var(--dim)', cursor: 'pointer', display: 'grid', placeItems: 'center' }}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"><path d="M2 4.5h7M12 4.5h2M2 11.5h2M7 11.5h7" /><circle cx="10.5" cy="4.5" r="1.6" /><circle cx="5.5" cy="11.5" r="1.6" /></svg>
      </button>
      <Dialog open={open} onClose={() => setOpen(false)} title={tr ? 'Ayarlar' : 'Settings'} width={420}
        footer={<><Button onClick={() => setOpen(false)}>{tr ? 'Kapat' : 'Close'}</Button><Button variant="primary" onClick={save}>{tr ? 'Kaydet' : 'Save'}</Button></>}>
        <div style={{ display: 'grid', gap: 14 }}>
          <Field label={tr ? 'Proje klasörü' : 'Project folder'} placeholder="/Users/you/my-app" value={root} onChange={(e) => setRoot(e.target.value)} hint={tr ? 'Kaynak yolları kök-göreliyse (Next.js, webpack) gerekir; Vite için gerekmez.' : 'Needed when source paths are root-relative (Next.js, webpack); not needed for Vite.'} />
          <div style={{ display: 'grid', gap: 5 }}><span style={{ fontFamily: 'var(--mono)', fontSize: 10.5, textTransform: 'uppercase', letterSpacing: '.06em', color: 'var(--dim)' }}>{tr ? 'Editör' : 'Editor'}</span>
            <Segmented label="Editor" items={[{ key: 'vscode' as const, label: 'VS Code' }, { key: 'cursor' as const, label: 'Cursor' }, { key: 'webstorm' as const, label: 'WebStorm' }]} value={editor} onChange={(k) => setEditor(k)} /></div>
          {msg && <div role="status" style={{ fontSize: 12, color: 'var(--dim)' }}>{msg}</div>}
        </div>
      </Dialog>
    </>
  )
}

function UpdateBanner() {
  const n = (useStore as any)((s: any) => s.updateNotice) as { latest: string; url: string } | null | undefined
  const [hidden, setHidden] = useState<string | null>(() => { try { return localStorage.getItem('izlix.update.hidden') } catch { return null } })
  if (!n || hidden === n.latest) return null
  const tr = lang === 'tr'
  return (
    <div role="status" style={{ position: 'fixed', left: 12, right: 12, bottom: 78, zIndex: 20, display: 'flex', alignItems: 'center', gap: 10, padding: '9px 12px', borderRadius: 12, border: '1px solid var(--g-brd2)', background: 'var(--panel)', boxShadow: 'var(--shadow-s)', fontSize: 12 }}>
      <span style={{ flex: 1 }}>{tr ? `Yeni sürüm var: ${n.latest}` : `Update available: ${n.latest}`}</span>
      <a href={n.url} target="_blank" rel="noreferrer" style={{ color: 'var(--ac)' }}>{tr ? 'Göster' : 'View'}</a>
      <button className="btn sm" onClick={() => { try { localStorage.setItem('izlix.update.hidden', n.latest) } catch { /* yok say */ } setHidden(n.latest) }}>{tr ? 'Gizle' : 'Dismiss'}</button>
    </div>
  )
}

function PanelApp() {
  const [size, setSize] = useState({ w: innerWidth, h: innerHeight })
  useEffect(() => {
    const onResize = (): void => setSize({ w: innerWidth, h: innerHeight }); addEventListener('resize', onResize)
    const queue: BusEvent[] = []
    const off = real.onEvent((e: BusEvent) => queue.push(e))
    void real.snapshot().then((l: BusEvent[]) => useStore.getState().ingest(l))
    const t = setInterval(() => { if (queue.length) useStore.getState().ingest(queue.splice(0)) }, 50) // olaydan ekrana < 100 ms butcesi
    return () => { removeEventListener('resize', onResize); clearInterval(t); off() }
  }, [])
  return <div className="panel side-right" style={{ position: 'fixed', inset: 0 }}><Timeline width={size.w} height={size.h} /><StatusBanner /><UpdateBanner /><SettingsButton /></div>
}
createRoot(document.getElementById('root')!).render(<PanelApp />)
