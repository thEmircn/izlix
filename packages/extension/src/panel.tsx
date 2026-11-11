import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import '../../../src/renderer/styles.css'
import type { BusEvent } from '../../../src/shared/events'
import { useStore } from '../../../src/renderer/store'
import { Timeline } from '../../../src/renderer/Timeline'

/** Panel bir uzantidir: kabuk API'sinin (window.izlix) yalnizca gereken kismi gercek, gerisi guvenli no-op. */
// test/tanilama: yakalanmamis hatalari say
const errs: string[] = []; (window as any).__izlixErrors = errs
addEventListener('error', (e) => errs.push(String(e.message))); addEventListener('unhandledrejection', (e) => errs.push(String((e as PromiseRejectionEvent).reason)))
const fixedTab = Number(new URLSearchParams(location.search).get('tabId')) || null
let tabId = fixedTab ?? 0
let KEY = `tab-${tabId}`
const port = chrome.runtime.connect({ name: 'izlix-panel' })
const evSubs = new Set<(e: BusEvent) => void>()
let snapshotResolve: ((l: BusEvent[]) => void) | null = null
let snapshotCache: BusEvent[] | null = null
const pending = new Map<number, (v: unknown) => void>(); let rpcSeq = 0
const rpc = (name: string, ...args: unknown[]): Promise<any> => new Promise((res) => { const id = ++rpcSeq; pending.set(id, res); port.postMessage({ t: 'rpc', id, name, args }) })
port.onMessage.addListener((m: any) => {
  if (m.t === 'events') { snapshotCache = m.events; snapshotResolve?.(m.events); snapshotResolve = null; if (m.tabId === tabId) useStore.getState().reset(m.events) }
  else if (m.t === 'update') useStore.setState({ updateNotice: m.notice } as any)
  else if (m.t === 'attach-error') useStore.setState({ attachError: m.message } as any)
  else if (m.t === 'ev') evSubs.forEach((fn) => fn(m.e))
  else if (m.t === 'rules') useStore.setState((s) => ({ rules: { ...s.rules, default: m.cfg } }))
  else if (m.t === 'rpc') { pending.get(m.id)?.(m.value); pending.delete(m.id) }
})
/** izlenecek sekmeyi sec: sabit (?tabId=) ya da gercek kenar panelinde etkin sekme (sekme degisince takip eder) */
function follow(id: number): void {
  if (!id || id === tabId && snapshotCache) return
  tabId = id; KEY = `tab-${id}`; snapshotCache = null
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
  openSource: (t: { file: string; line: number; column?: number; editor?: string }) => rpc('openSource', t)
}
;(window as any).izlix = new Proxy(real, { get: (t, p: string) => t[p] ?? ((...a: any[]) => (p.startsWith('on') ? () => {} : Promise.resolve(null))) })

useStore.setState({
  allowedPanels: ['timeline', 'raw', 'network', 'console', 'renders'], // olay verisiyle calisan paneller (diger paneller ilerleyen surumlerde)
  activeTabId: KEY, panelOpen: true, panelTab: 'timeline', activeWorkspaceId: 'default',
  settings: { ...useStore.getState().settings, language: lang, onboarded: true } as any,
  tabs: [{ id: KEY, workspaceId: 'default', title: '', url: '', loading: false, canGoBack: false, canGoForward: false } as any]
})

void rpc('getRules').then((cfg) => useStore.setState((s) => ({ rules: { ...s.rules, default: cfg } })))

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
  return <div className="panel side-right" style={{ position: 'fixed', inset: 0 }}><Timeline width={size.w} height={size.h} /><UpdateBanner /></div>
}
createRoot(document.getElementById('root')!).render(<PanelApp />)
