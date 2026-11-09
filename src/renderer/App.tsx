import { useEffect, useState } from 'react'
import { computeLayout } from '../shared/layout'
import type { DevToolsDock } from '../shared/events'
import { useStore, writePref } from './store'
import { Timeline } from './Timeline'

const CHROME_H = 84 // sekme seridi 38 + arac cubugu 46

export function App() {
  const s = useStore()
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [addr, setAddr] = useState('')
  const [editing, setEditing] = useState(false)
  const active = s.tabs.find((t) => t.id === s.activeTabId)
  const myTabs = s.tabs.filter((t) => t.workspaceId === s.activeWorkspaceId)
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)

  useEffect(() => {
    const api = window.izlix
    const queue: any[] = []
    const offs = [
      api.onTabs((p) => s.set({ tabs: p.tabs, activeTabId: p.activeId, dock: p.dock })),
      api.onWorkspaces((p) => s.set({ workspaces: p.workspaces, activeWorkspaceId: p.activeId, detected: p.detected })),
      api.onEvent((e) => queue.push(e)), api.onUpdate((e) => queue.push(e))
    ]
    // 100 ms'de bir toplu guncelle (Timeline gecikme butcesi: olaydan ekrana < 100 ms)
    const t = setInterval(() => { if (queue.length) useStore.getState().ingest(queue.splice(0)) }, 100)
    const onResize = (): void => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => { offs.forEach((f) => f()); clearInterval(t); window.removeEventListener('resize', onResize) }
  }, [])

  // sekme degisince o sekmenin olay gecmisini yukle
  useEffect(() => { if (s.activeTabId) window.izlix.snapshot(s.activeTabId).then((l: any) => useStore.getState().ingest(l)) }, [s.activeTabId])
  // adres cubugu: duzenlenmiyorsa aktif sekmenin URL'sini goster
  useEffect(() => { if (!editing) setAddr(active?.url ?? '') }, [active?.url, editing])
  // yerlesimi main surece bildir (WebContentsView sinirlari ayni hesapla belirlenir)
  useEffect(() => { void window.izlix.setLayout({ dock: s.dock, panelRatio: s.panelRatio, chromeHeight: CHROME_H }) }, [s.dock, s.panelRatio])

  const layout = computeLayout(size.w, size.h, { dock: s.dock, panelRatio: s.panelRatio, chromeHeight: CHROME_H })
  const setDock = (d: DevToolsDock): void => { writePref('dock', d); s.set({ dock: d }) }
  const api = window.izlix
  const nav = (fn: (id: string) => unknown) => (): void => { if (active) void fn(active.id) }

  return (
    <>
      <div className="tabstrip drag">
        {myTabs.map((t) => (
          <div key={t.id} className={`tab nodrag ${t.id === s.activeTabId ? 'active' : ''}`} onClick={() => api.activateTab(t.id)} title={t.url}>
            <span className="t">{t.loading ? '⟳ ' : ''}{t.title || 'New Tab'}</span>
            <button aria-label="Sekmeyi kapat" onClick={(e) => { e.stopPropagation(); void api.closeTab(t.id) }}>×</button>
          </div>
        ))}
        <button className="nodrag" aria-label="Yeni sekme" onClick={() => api.createTab()} style={{ border: 0, background: 'none', color: 'var(--dim)', fontSize: 18, cursor: 'pointer', height: 30 }}>+</button>
      </div>

      <div className="toolbar">
        <button aria-label="Geri" disabled={!active?.canGoBack} onClick={nav(api.back)}>‹</button>
        <button aria-label="İleri" disabled={!active?.canGoForward} onClick={nav(api.forward)}>›</button>
        <button aria-label="Yenile" disabled={!active} onClick={nav(api.reload)}>↻</button>
        <form style={{ flex: 1, display: 'flex' }} onSubmit={(e) => { e.preventDefault(); if (active) void api.go(active.id, addr); (document.activeElement as HTMLElement)?.blur() }}>
          <input className="addr" value={addr} placeholder="Adres ara ya da gir (localhost:5173)" spellCheck={false}
            onFocus={(e) => { setEditing(true); e.target.select() }} onBlur={() => setEditing(false)} onChange={(e) => setAddr(e.target.value)} />
        </form>
        <select aria-label="Workspace" value={s.activeWorkspaceId} onChange={(e) => { if (e.target.value === '__new') void api.createWorkspace('', null); else void api.switchWorkspace(e.target.value) }}>
          {s.workspaces.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
          <option value="__new">＋ Klasörden Workspace…</option>
        </select>
        {(s.detected.length ? s.detected : []).map((d) => (
          <button key={d.port} className="chip" title={d.cwd ?? ''} onClick={() => api.createTab(`localhost:${d.port}`)}>
            ● {d.port}{d.framework ? ` ${d.framework}` : ''}{ws?.servers.some((x) => x.port === d.port) ? ' ✓' : ''}
          </button>
        ))}
        <select aria-label="DevTools" value={s.dock} onChange={(e) => setDock(e.target.value as DevToolsDock)}>
          <option value="right">DevTools sağda</option><option value="bottom">DevTools altta</option><option value="off">DevTools kapalı</option>
        </select>
      </div>

      {!active && <div className="empty" style={{ left: 0, top: CHROME_H, width: layout.page.width, height: layout.page.height }}>Sekme yok. ＋ ile aç.</div>}
      <div className="panel" style={{ left: layout.timeline.x, top: layout.timeline.y, width: layout.timeline.width, height: layout.timeline.height }}>
        <Timeline width={layout.timeline.width} />
      </div>
    </>
  )
}
