import { useEffect, useState } from 'react'
import { computeLayout, padRect } from '../shared/layout'
import { Home } from './Home'
import type { DevToolsDock } from '../shared/events'
import { useStore, writePref, useT, toast, PANEL_TABS, wsName } from './store'
import { Welcome } from './Welcome'
import { Toasts } from './Toasts'
import { Settings } from './Settings'
import { Shortcuts } from './Shortcuts'
import { MarkerPrompt } from './MarkerPrompt'
import { PermissionPrompt } from './PermissionPrompt'
import { Back, Forward, Reload, Plus, Close, Star, Download, Spinner } from './icons'
import { RenameWorkspace } from './RenameWorkspace'
import { Timeline } from './Timeline'
import { Palette } from './Palette'
import { RulesPanel } from './RulesPanel'
import { activeRules } from '../shared/rules'
import { deviceById } from '../shared/lab'
import { emuActive, geoPreset, networkPreset } from '../shared/emulation'

const CHROME_H = 84 // sekme seridi 38 + arac cubugu 46
const LAB_BAR_H = 26 // Responsive Lab acikken viewport seridi

export function App() {
  const s = useStore()
  const t = useT()
  const [dragging, setDragging] = useState(false)
  const [dragTab, setDragTab] = useState<string | null>(null)
  const [overTab, setOverTab] = useState<string | null>(null)
  const [findText, setFindText] = useState('')
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [addr, setAddr] = useState('')
  const [editing, setEditing] = useState(false)
  const active = s.tabs.find((t) => t.id === s.activeTabId)
  const myTabs = s.tabs.filter((t) => t.workspaceId === s.activeWorkspaceId)
  const nActive = activeRules(s.rules[s.activeWorkspaceId] ?? { rules: [], domains: [] }).length
  const bookmarked = !!active && (s.bookmarks[s.activeWorkspaceId] ?? []).some((b) => b.url === active.url)
  const busyDl = s.downloads.filter((d) => d.state === 'progressing').length
  const chromeH = CHROME_H + (active?.lab ? LAB_BAR_H : 0)
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)

  useEffect(() => {
    const api = window.izlix
    const queue: any[] = []
    const offs = [
      api.onTabs((p) => s.set({ tabs: p.tabs, activeTabId: p.activeId })),
      api.onWorkspaces((p) => s.set({ workspaces: p.workspaces, activeWorkspaceId: p.activeId, detected: p.detected })),
      api.onRules((r) => s.set({ rules: r })),
      api.onPermAsk((p: any) => useStore.setState((st) => ({ permPrompts: [...st.permPrompts, p] }))),
      api.onFind((r: any) => { if (r.id === useStore.getState().activeTabId) s.set({ find: { open: true, active: r.active, total: r.total } }) }),
      api.onSettings((st: any) => { s.set({ settings: st }); if (!st.onboarded && useStore.getState().overlay === null) s.set({ overlay: 'welcome' }) }),
      api.onLibrary((l: any) => s.set({ bookmarks: l.bookmarks, downloads: l.downloads })),
      api.onCommand((cmd: string) => {
        const st = useStore.getState(); const act = st.tabs.find((t) => t.id === st.activeTabId)
        switch (cmd) {
          case 'palette.open': void api.track('palette.open'); st.set({ overlay: st.overlay === 'palette' ? null : 'palette' }); break
          case 'rules.open': st.set({ overlay: 'rules' }); break
          case 'marker.open': st.set({ overlay: 'marker' }); break
          case 'shortcuts.open': st.set({ overlay: st.overlay === 'shortcuts' ? null : 'shortcuts' }); break
          case 'settings.open': st.set({ overlay: 'settings' }); break
          case 'find.open': st.set({ find: { open: true, active: 0, total: 0 } }); break
          case 'devtools.toggle': { const d = st.dock === 'off' ? 'right' : 'off'; writePref('dock', d); st.set({ dock: d }); break }
          case 'bookmark.toggle': if (act) void api.toggleBookmark(act.id); break
          case cmd.startsWith('panel.') ? cmd : '': { const k = PANEL_TABS[Number(cmd.slice(6))]; if (k) st.set({ panelTab: k }); break }
          case cmd.startsWith('tab.go.') || cmd === 'tab.next' || cmd === 'tab.prev' ? cmd : '': {
            const mine = st.tabs.filter((x) => x.workspaceId === st.activeWorkspaceId)
            if (!mine.length) break
            const cur = mine.findIndex((x) => x.id === st.activeTabId)
            const idx = cmd === 'tab.next' ? (cur + 1) % mine.length : cmd === 'tab.prev' ? (cur - 1 + mine.length) % mine.length : Number(cmd.slice(7)) === 9 ? mine.length - 1 : Math.min(Number(cmd.slice(7)) - 1, mine.length - 1)
            void api.activateTab(mine[idx].id); break
          }
          case 'tab.reopen': void api.reopenTab(); break
          case 'tab.new': void api.createTab(); break
          case 'tab.close': if (act) void api.closeTab(act.id); break
          case 'nav.reload': if (act) void api.reload(act.id); break
          case 'addr.focus': (document.querySelector('.addr') as HTMLInputElement | null)?.focus(); break
        }
      }),
      api.onEvent((e) => queue.push(e)), api.onUpdate((e) => queue.push(e))
    ]
    // 50 ms de bir toplu guncelle (Timeline gecikme butcesi: olaydan ekrana < 100 ms)
    const t = setInterval(() => { if (queue.length) useStore.getState().ingest(queue.splice(0)) }, 50)
    const onResize = (): void => setSize({ w: window.innerWidth, h: window.innerHeight })
    window.addEventListener('resize', onResize)
    return () => { offs.forEach((f) => f()); clearInterval(t); window.removeEventListener('resize', onResize) }
  }, [])

  useEffect(() => { void window.izlix.getSettings().then((st: any) => { useStore.getState().set({ settings: st, ...(st.onboarded ? {} : { overlay: 'welcome' as const }) }) }) }, [])
  // sekme degisince o sekmenin olay gecmisini yukle
  useEffect(() => { if (s.activeTabId) window.izlix.snapshot(s.activeTabId).then((l: any) => useStore.getState().ingest(l)) }, [s.activeTabId])
  // overlay acikken sayfa gorunumleri (native katman) gizlenir, aksi halde shell'in ustunde kalirlardi
  useEffect(() => { void window.izlix.setOverlay(s.overlay !== null || s.permPrompts.length > 0) }, [s.overlay, s.permPrompts.length])
  // adres cubugu: duzenlenmiyorsa aktif sekmenin URL'sini goster
  useEffect(() => { if (!editing) setAddr(active?.url ?? '') }, [active?.url, editing])
  // yerlesimi main surece bildir (WebContentsView sinirlari ayni hesapla belirlenir)
  useEffect(() => { void window.izlix.setLayout({ dock: s.dock, panelRatio: s.panelRatio, chromeHeight: chromeH, split: s.split }) }, [s.dock, s.panelRatio, s.split, chromeH])

  const layout = computeLayout(size.w, size.h, { dock: s.dock, panelRatio: s.panelRatio, chromeHeight: chromeH, split: s.split })
  const setDock = (d: DevToolsDock): void => { writePref('dock', d); s.set({ dock: d }) }
  const api = window.izlix
  // Panel boyutlandirma: surukleme sirasinda native gorunumler gizlenir (aksi halde fare olaylarini yutarlar)
  const startDrag = (axis: 'x' | 'y') => (e: React.PointerEvent): void => {
    e.preventDefault(); setDragging(true); void api.setOverlay(true)
    const bodyH = size.h - chromeH
    const move = (ev: PointerEvent): void => {
      if (axis === 'x') s.set({ panelRatio: Math.min(0.8, Math.max(0.2, 1 - ev.clientX / size.w)) })
      else s.set({ split: Math.min(0.8, Math.max(0.2, (ev.clientY - chromeH) / bodyH)) })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      const st = useStore.getState(); writePref('panelRatio', String(+st.panelRatio.toFixed(3))); writePref('split', String(+st.split.toFixed(3)))
      setDragging(false); void api.setOverlay(useStore.getState().overlay !== null)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const nav = (fn: (id: string) => unknown) => (): void => { if (active) void fn(active.id) }

  return (
    <>
      <div className="tabstrip drag">
        {myTabs.map((tb) => (
          <div key={tb.id} draggable className={`tab nodrag ${tb.split ? 'split' : ''} ${tb.id === s.activeTabId ? 'active' : ''} ${dragTab === tb.id ? 'dragging' : ''} ${overTab === tb.id && dragTab !== tb.id ? 'dropping' : ''}`}
            onDragStart={(e) => { setDragTab(tb.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tb.id) }}
            onDragOver={(e) => { if (dragTab) { e.preventDefault(); setOverTab(tb.id) } }}
            onDrop={(e) => { e.preventDefault(); if (dragTab && dragTab !== tb.id) { const idx = s.tabs.findIndex((x) => x.id === tb.id); void api.moveTab(dragTab, idx) } setDragTab(null); setOverTab(null) }}
            onDragEnd={() => { setDragTab(null); setOverTab(null) }} onClick={() => api.activateTab(tb.id)} onContextMenu={(e) => { e.preventDefault(); void api.tabMenu(tb.id) }} title={tb.url}>
            <span className="t">{tb.loading && <Spinner style={{ marginRight: 6, verticalAlign: -1 }} />}{!tb.title || tb.title === 'New Tab' ? t('tab.untitled') : tb.title}</span>
            <button aria-label={t('tab.close')} onClick={(e) => { e.stopPropagation(); void api.closeTab(tb.id) }}><Close /></button>
          </div>
        ))}
        <button className="nodrag newtab" aria-label={t('tab.new')} onClick={() => api.createTab()}><Plus /></button>
      </div>

      <div className="toolbar">
        <button aria-label={t('nav.back')} disabled={!active?.canGoBack} onClick={nav(api.back)}><Back /></button>
        <button aria-label={t('nav.forward')} disabled={!active?.canGoForward} onClick={nav(api.forward)}><Forward /></button>
        <button aria-label={t('nav.reload')} disabled={!active} onClick={nav(api.reload)}><Reload /></button>
        <button aria-label={t('bookmark')} title={t('bookmark.title')} disabled={!active?.url} style={{ color: bookmarked ? '#fbbf24' : undefined }} onClick={() => { if (active) void api.toggleBookmark(active.id).then((on: boolean) => toast(t(on ? 'toast.bookmarked' : 'toast.unbookmarked'))) }}><Star filled={bookmarked} /></button>
        <form style={{ flex: 1, display: 'flex' }} onSubmit={(e) => { e.preventDefault(); if (active) void api.go(active.id, addr); (document.activeElement as HTMLElement)?.blur() }}>
 <input className="addr" value={addr} placeholder={t('addr.placeholder')} spellCheck={false}
            onFocus={(e) => { setEditing(true); e.target.select() }} onBlur={() => setEditing(false)} onChange={(e) => setAddr(e.target.value)} />
          {nActive > 0 && (
            <button type="button" className="rule-badge nodrag" title={t('rules.badge.title')} onClick={() => s.set({ overlay: 'rules' })}>{t('rules.badge', { n: nActive })}</button>
          )}
        </form>
        {emuActive(active?.emu) && active && (
          <button type="button" className="chip emu" title={t('emu.resetTip')} onClick={() => void api.setEmulation(active.id, { network: null, cpu: null, geo: null })}>
            {[networkPreset(active.emu?.network)?.label, active.emu?.cpu ? `CPU ${active.emu.cpu}×` : '', geoPreset(active.emu?.geo)?.label].filter(Boolean).join(' · ')}<Close />
          </button>
        )}
        {s.find.open && active && (
          <span className="nodrag" style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            <input autoFocus className="addr" style={{ width: 170, flex: 'none' }} placeholder={t('find.placeholder')} value={findText}
              onChange={(e) => { setFindText(e.target.value); if (e.target.value) void api.findStart(active.id, e.target.value, true, false); else void api.findStop(active.id) }}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && findText) void api.findStart(active.id, findText, !e.shiftKey, true)
                if (e.key === 'Escape') { void api.findStop(active.id); s.set({ find: { open: false, active: 0, total: 0 } }) }
              }} />
            <span style={{ color: 'var(--dim)', minWidth: 36 }}>{findText ? `${s.find.active}/${s.find.total}` : ''}</span>
            <button aria-label={t('find.close')} onClick={() => { void api.findStop(active.id); s.set({ find: { open: false, active: 0, total: 0 } }) }}><Close /></button>
          </span>
        )}
        {s.downloads.length > 0 && (
          <button className="chip" title={s.downloads.map((d) => `${d.name} (${d.state})`).join('\n')} onClick={() => s.set({ overlay: 'palette' })}>
            <Download />{' '}{busyDl ? t('dl.busy', { n: busyDl }) : t('dl.count', { n: s.downloads.length })}
          </button>
        )}
        <select aria-label={t('workspace')} value={s.activeWorkspaceId} onChange={(e) => { if (e.target.value === '__new') void api.createWorkspace('', null); else void api.switchWorkspace(e.target.value) }}>
          {s.workspaces.map((w) => <option key={w.id} value={w.id}>{wsName(w)}</option>)}
          <option value="__new">{t('ws.fromFolder')}</option>
        </select>
        {(s.detected.length ? s.detected : []).map((d) => (
          <button key={d.port} className="chip" title={d.cwd ?? ''} onClick={() => api.createTab(`localhost:${d.port}`)}>
            <i className="dot" />{d.port}{d.framework ? ` ${d.framework}` : ''}{ws?.servers.some((x) => x.port === d.port) ? <span className="mine">{t('ws.mine')}</span> : null}
          </button>
        ))}
        <select aria-label={t('devtools')} value={s.dock} onChange={(e) => setDock(e.target.value as DevToolsDock)}>
          <option value="right">{t('dock.right')}</option><option value="bottom">{t('dock.bottom')}</option><option value="off">{t('dock.off')}</option>
        </select>
      </div>

      {active?.lab && (
        <div className="labbar" data-testid="labbar">
          <b>{t('lab.title')}</b>
          {active.lab.map((id, i) => {
            const d = deviceById(id)
            return <span key={i} className="chip" style={{ cursor: 'default' }}>{d?.label ?? id} {d ? `${d.width}×${d.height}` : ''}</span>
          })}
          <button className="chip" onClick={() => void api.setLab(active.id, null)}>{t('lab.exit')}</button>
          <span style={{ color: 'var(--dim)' }}>{t('lab.hint')}</span>
        </div>
      )}
      {!active && <Home style={{ left: padRect(layout.page).x, top: padRect(layout.page).y, width: padRect(layout.page).width, height: padRect(layout.page).height }} />}
      <div className="panel" style={{ left: padRect(layout.timeline).x, top: padRect(layout.timeline).y, width: padRect(layout.timeline).width, height: padRect(layout.timeline).height }}>
        <Timeline width={padRect(layout.timeline).width} height={padRect(layout.timeline).height} />
      </div>
      {s.dock === 'right' && <div className="resizer-h nodrag" onPointerDown={startDrag('y')} style={{ left: layout.timeline.x, width: layout.timeline.width, top: layout.timeline.y + layout.timeline.height - 3 }} />}
      <div className="resizer-v nodrag" onPointerDown={startDrag('x')} style={{ left: layout.timeline.x - 3, top: chromeH, height: layout.timeline.height }} />
      {dragging && <div style={{ position: 'fixed', inset: 0, zIndex: 40, cursor: 'grabbing' }} />}
      <Toasts />
      <PermissionPrompt />
      {s.overlay === 'marker' && <MarkerPrompt onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'shortcuts' && <Shortcuts onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'settings' && <Settings onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'rename' && <RenameWorkspace onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'welcome' && <Welcome onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'palette' && <Palette onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'rules' && <RulesPanel onClose={() => s.set({ overlay: null })} />}
    </>
  )
}
