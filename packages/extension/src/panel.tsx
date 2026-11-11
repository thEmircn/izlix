import { createRoot } from 'react-dom/client'
import { useEffect, useState } from 'react'
import '../../../src/renderer/styles.css'
import type { BusEvent } from '../../../src/shared/events'
import { useStore } from '../../../src/renderer/store'
import { Timeline } from '../../../src/renderer/Timeline'

/** Panel bir uzantidir: kabuk API'sinin (window.izlix) yalnizca gereken kismi gercek, gerisi guvenli no-op. */
const tabId = Number(new URLSearchParams(location.search).get('tabId'))
const KEY = `tab-${tabId}`
const port = chrome.runtime.connect({ name: 'izlix-panel' })
const evSubs = new Set<(e: BusEvent) => void>()
let snapshotResolve: ((l: BusEvent[]) => void) | null = null
let snapshotCache: BusEvent[] | null = null
port.onMessage.addListener((m: any) => {
  if (m.t === 'events') { snapshotCache = m.events; snapshotResolve?.(m.events); snapshotResolve = null }
  else if (m.t === 'ev') evSubs.forEach((fn) => fn(m.e))
})
port.postMessage({ t: 'hello', tabId })

const lang = navigator.language.toLowerCase().startsWith('tr') ? 'tr' : 'en'
const real: Record<string, (...a: any[]) => any> = {
  snapshot: () => (snapshotCache ? Promise.resolve(snapshotCache) : new Promise<BusEvent[]>((r) => { snapshotResolve = r })),
  onEvent: (cb: (e: BusEvent) => void) => { evSubs.add(cb); return () => evSubs.delete(cb) },
  onUpdate: () => () => {}, // guncellemeler de 'ev' mesajiyla gelir (onEvent ayni dinleyiciye gider)
  getSettings: () => Promise.resolve({ language: lang, onboarded: true, telemetry: 'denied' }),
  track: () => Promise.resolve()
}
;(window as any).izlix = new Proxy(real, { get: (t, p: string) => t[p] ?? ((...a: any[]) => (p.startsWith('on') ? () => {} : Promise.resolve(null))) })

useStore.setState({
  activeTabId: KEY, panelOpen: true, panelTab: 'timeline', activeWorkspaceId: 'default',
  settings: { ...useStore.getState().settings, language: lang, onboarded: true } as any,
  tabs: [{ id: KEY, workspaceId: 'default', title: '', url: '', loading: false, canGoBack: false, canGoForward: false } as any]
})

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
  return <div className="panel side-right" style={{ position: 'fixed', inset: 0 }}><Timeline width={size.w} height={size.h} /></div>
}
createRoot(document.getElementById('root')!).render(<PanelApp />)
