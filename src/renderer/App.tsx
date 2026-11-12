import { originKey } from '../shared/favicon'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { Sug } from '../shared/suggest'
import { inSet, isLoopbackHost, siteOf } from '../shared/adblock'
import { IcShield, IcHop, IcSpeaker, IcMuted, IcTune, IcKey } from './icons'
import { SiteSettings } from './SiteSettings'
import { HistoryPage } from './HistoryPage'
import { QrDialog } from './QrDialog'
import { TabSearch } from './TabSearch'
import { DownloadsPage } from './DownloadsPage'
import { NotePrompt, NotesPage } from './Notes'
import { UsagePage } from './UsagePage'
import { HubPage } from './HubPage'
import { AiDialog } from './AiDialog'
import { BudgetChip } from './BudgetChip'
import { RecorderDialog } from './RecorderDialog'
import { BookmarkManager, BookmarkBar, BM_H } from './Bookmarks'
import { Roll, Select } from './ui'
import { GROUP_COLORS } from '../shared/groups'
import { GroupChip } from './GroupChip'
import { SuggestList, useSuggestions } from './Suggest'
import { computeLayout, padRect, type PanelSide } from '../shared/layout'
import { StartPage } from './StartPage'
import { DashboardView } from './DashboardView'
import { IcDockB, IcDockL, IcOverview, IcPanel } from './icons'
import { SessionPrompt } from './SessionPrompt'
import type { DevToolsDock } from '../shared/events'
import { useStore, writePref, useT, toast, tNow, PANEL_TABS, wsName, useTween } from './store'
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
import { emuActive, geoPreset, networkPreset, uaPreset } from '../shared/emulation'

const CHROME_H = 84 // sekme seridi 38 + arac cubugu 46
const CHROME_H_SIDE = 46 // dikey sekme duzeninde yalnizca arac cubugu
const SIDE_W = 232, SIDE_W_COLLAPSED = 56
const appWinTab = (t: { winId?: number }, st: { winId: number }): boolean => t.winId === st.winId
const APPBAR_H = 38 // uygulama penceresinde yalnizca ince baslik cubugu
const LAB_BAR_H = 26 // Responsive Lab acikken viewport seridi

export function App() {
  const s = useStore()
  const t = useT()
  const [dragging, setDragging] = useState(false)
  /** sayfa gorunumu gizlenirken kabukte gosterilen donmus goruntu */
  const [frozen, setFrozen] = useState<{ url: string; w: number; h: number } | null>(null)
  const [dragTab, setDragTab] = useState<string | null>(null)
  const [overTab, setOverTab] = useState<string | null>(null)
  const [findText, setFindText] = useState('')
  const [size, setSize] = useState({ w: window.innerWidth, h: window.innerHeight })
  const [addr, setAddr] = useState('')
  const [editing, setEditing] = useState(false)
  const addrRef = useRef<HTMLInputElement>(null)
  const [typed, setTyped] = useState<string | null>(null) // kullanicinin yazdigi metin (tamamlama ve oneriler buna gore)
  const sg = useSuggestions(typed ?? '', editing)
  const sugOpen = typed !== null && editing && (sg.items.length > 1 || sg.items[0]?.kind === 'shortcut')
  const pendingSel = useRef<[number, number] | null>(null)
  useLayoutEffect(() => { if (pendingSel.current && addrRef.current) { addrRef.current.setSelectionRange(...pendingSel.current); pendingSel.current = null } })
  const active = s.tabs.find((t) => t.id === s.activeTabId)
  const myTabs = s.tabs.filter((t) => t.workspaceId === s.activeWorkspaceId && (!t.app || appWinTab(t, s)))
  const nActive = activeRules(s.rules[s.activeWorkspaceId] ?? { rules: [], domains: [] }).length
  const insecure = /^http:/.test(active?.url ?? '') && !isLoopbackHost(((): string => { try { return new URL(active?.url ?? '').hostname } catch { return '' } })()) && !/\.onion$/.test(active?.url ?? '')
  const pageHost = (() => { try { return new URL(active?.url ?? '').hostname.toLowerCase() } catch { return '' } })()
  const adLevel = s.settings.adblock ?? 'ads'
  const shieldShown = /^https?:/.test(active?.url ?? '') && !isLoopbackHost(pageHost) && !active?.private
  const siteAllowed = inSet(pageHost, new Set(s.settings.adblockAllow ?? []))
  const adOff = adLevel === 'off' || siteAllowed
  const pickSug = (x: Sug): void => { setTyped(null); if (x.kind === 'tab' && x.tabId) void api.activateTab(x.tabId); else if (active) void api.go(active.id, x.url); else void api.createTab(x.url); addrRef.current?.blur() }
  const bookmarked = !!active && (s.bookmarks[s.activeWorkspaceId] ?? []).some((b) => b.url === active.url)
  const busyDl = s.downloads.filter((d) => d.state === 'progressing').length
  const appWin = s.appWin
  const vertical = s.tabLayout === 'side' && !appWin
  const sideW = vertical ? (s.sideCollapsed ? SIDE_W_COLLAPSED : SIDE_W) : 0
  const chromeH = appWin ? APPBAR_H : (vertical ? CHROME_H_SIDE : CHROME_H) + (active?.lab ? LAB_BAR_H : 0) + (s.bmBar ? BM_H : 0)
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)

  useEffect(() => {
    const api = window.izlix
    const queue: any[] = []
    void api.favicons([]).then((f) => useStore.setState((st) => ({ favicons: { ...f, ...st.favicons } }))).catch(() => {})
    const offs = [
      api.onTabs((p: any) => s.set({ tabs: p.tabs, activeTabId: p.activeId, winId: p.win ?? 0, wins: p.wins ?? 1, groups: p.groups ?? [], appWin: !!p.app })),
      api.onWorkspaces((p) => s.set({ workspaces: p.workspaces, activeWorkspaceId: p.activeId, detected: p.detected })),
      api.onRules((r) => s.set({ rules: r })),
      api.onRec((r: any) => s.set({ rec: r })),
      api.onReplay((m: { i: number; state: 'run' | 'ok' | 'fail' | 'skip' }) => useStore.setState((st) => ({ replay: { ...st.replay, states: { ...st.replay.states, [m.i]: m.state } } }))),
      api.onSpeak((on: boolean) => s.set({ speaking: on })),
      api.onNoteAsk((a: any) => s.set({ noteAsk: a, overlay: 'notePrompt' })),
      api.onFavicon((f: { origin: string; url: string }) => useStore.setState((st) => ({ favicons: { ...st.favicons, [f.origin]: f.url } }))),
      api.onPermAsk((p: any) => useStore.setState((st) => ({ permPrompts: [...st.permPrompts, p] }))),
      api.onPermClose((p: { id: string }) => useStore.setState((st) => ({ permPrompts: st.permPrompts.filter((x) => x.id !== p.id) }))),
      api.onFind((r: any) => { if (r.id === useStore.getState().activeTabId) s.set({ find: { open: true, active: r.active, total: r.total } }) }),
      api.onSettings((st: any) => { s.set({ settings: st }); if (!st.onboarded && useStore.getState().overlay === null) s.set({ overlay: 'welcome' }) }),
      api.onLibrary((l: any) => s.set({ bookmarks: l.bookmarks, downloads: l.downloads })),
      api.onSessions((x: any) => s.set({ sessions: x })),
      api.onCommand((cmd: string) => {
        const st = useStore.getState(); const act = st.tabs.find((t) => t.id === st.activeTabId)
        if (st.appWin && (cmd.startsWith('panel.') || cmd.startsWith('dashboard.') || cmd === 'inspect.elements' || cmd === 'devtools.toggle')) return // uygulama penceresinde panel yok
        switch (cmd) {
          case 'palette.open': void api.track('palette.open'); st.set({ overlay: st.overlay === 'palette' ? null : 'palette' }); break
          case 'rules.open': st.set({ overlay: 'rules' }); break
          case 'marker.open': st.set({ overlay: 'marker' }); break
          case 'shortcuts.open': st.set({ overlay: st.overlay === 'shortcuts' ? null : 'shortcuts' }); break
          case 'settings.open': if (window.izlix.testMode || !window.izlix.openSettingsWindow) st.set({ overlay: 'settings' }); else void window.izlix.openSettingsWindow(); break
          case 'find.open': st.set({ find: { open: true, active: 0, total: 0 } }); break
          case 'panel.side.left': case 'panel.side.right': case 'panel.side.bottom': st.set({ panelSide: cmd.slice(11) as PanelSide, panelOpen: true, dashboard: false }); break
          case 'panel.toggle': st.set({ panelOpen: !st.panelOpen, dashboard: false }); break
          case 'dashboard.toggle': st.set({ dashboard: !st.dashboard }); break
          case 'devtools.toggle': { const d = st.dock === 'off' ? 'right' : 'off'; writePref('dock', d); st.set({ dock: d }); break }
          case 'bookmark.toggle': if (act) void api.toggleBookmark(act.id); break
          case cmd.startsWith('panel.') ? cmd : '': { const k = PANEL_TABS[Number(cmd.slice(6))]; if (k) st.set({ panelTab: k }); break }
          case cmd.startsWith('tab.go.') || cmd === 'tab.next' || cmd === 'tab.prev' ? cmd : '': {
            const mine = st.tabs.filter((x) => x.workspaceId === st.activeWorkspaceId && (x.winId ?? st.winId) === st.winId)
            if (!mine.length) break
            const cur = mine.findIndex((x) => x.id === st.activeTabId)
            const idx = cmd === 'tab.next' ? (cur + 1) % mine.length : cmd === 'tab.prev' ? (cur - 1 + mine.length) % mine.length : Number(cmd.slice(7)) === 9 ? mine.length - 1 : Math.min(Number(cmd.slice(7)) - 1, mine.length - 1)
            void api.activateTab(mine[idx].id); break
          }
          case 'tab.reopen': void api.reopenTab(); break
          case 'zoom.in': case 'zoom.out': case 'zoom.reset': if (act) void api.zoom(act.id, cmd.slice(5) as 'in' | 'out' | 'reset'); break
          case 'pw.fill': if (act && act.logins) void api.pwFill(act.id); break
          case 'bm.open': st.set({ overlay: 'bookmarks' }); break
          case 'bmbar.toggle': { const v = !st.bmBar; writePref('bmBar', v ? '1' : '0'); st.set({ bmBar: v }); break }
          case 'rec.toggle': { if (st.rec.recording) void api.recStop().then((steps: any) => st.set({ rec: { recording: false, tabId: null, steps }, overlay: 'recorder' })); else void api.recStart(); break }
          case 'rec.open': st.set({ overlay: 'recorder' }); break
          case 'qr.open': if (act && /^https?:/.test(act.url)) st.set({ overlay: 'qr' }); break
          case 'inspect.elements': st.set({ panelTab: 'elements', panelOpen: true, dashboard: false }); break
          case 'speak.toggle': if (st.speaking) void api.speak('stop'); else void api.speak('auto'); break
          case 'ai.explain': st.set({ overlay: 'ai', aiFocus: undefined }); break
          case 'usage.open': st.set({ overlay: 'usage' }); break
          case 'svch.open': st.set({ overlay: 'hub' }); break
          case 'notes.open': st.set({ overlay: 'notes' }); break
          case 'tabsearch.open': st.set({ overlay: 'tabsearch' }); break
          case 'downloads.open': st.set({ overlay: 'downloads' }); break
          case 'history.open': st.set({ overlay: 'history' }); break
          case 'site.open': st.set({ overlay: 'site' }); break
          case 'page.print': void api.printPage('print'); break
          case 'page.pdf': void api.printPage('pdf').then((f: string | null) => { if (f) toast(tNow('print.saved')) }); break
          case 'win.new': void api.newWindow(); break
          case 'tab.hop': if (act) void api.hopTab(act.id); break
          case 'tab.new': void api.createTab(); break
          case 'tab.newPrivate': void api.createTab(undefined, 'incognito')
          case 'reader.toggle': void api.reader().then((r: string) => { if (r === 'none') toast(tNow('reader.none')) }); break
          case 'tab.newTor': void api.createTab(undefined, 'tor'); break
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

  useEffect(() => { void window.izlix.setSettings({ editor: s.editor }) }, [s.editor])
  useEffect(() => { if (s.appWin) s.set({ panelOpen: false, dashboard: false }) }, [s.appWin])
  // Ayarlar penceresinden gelen yerel tercihler (yerlesim, editor, dock) ve komutlar
  useEffect(() => {
    if (typeof BroadcastChannel === 'undefined') return
    const ch = new BroadcastChannel('izlix-prefs')
    ch.onmessage = (e) => { if (e.data && typeof e.data === 'object') useStore.getState().set(e.data as never) }
    return () => ch.close()
  }, [])
  // tema degisince renk gecisi yumusak olsun (ilk yuklemede degil)
  const themePref = s.settings.theme ?? 'system'
  const themeSeen = useRef(themePref)
  useEffect(() => {
    if (themeSeen.current === themePref) return
    themeSeen.current = themePref
    document.documentElement.classList.add('theming')
    const h = window.setTimeout(() => document.documentElement.classList.remove('theming'), 450)
    return () => window.clearTimeout(h)
  }, [themePref])
  useEffect(() => { void window.izlix.getSettings().then((st: any) => { useStore.getState().set({ settings: st, ...(st.onboarded ? {} : { overlay: 'welcome' as const }) }) }) }, [])
  // sekme degisince o sekmenin olay gecmisini yukle
  useEffect(() => { if (s.activeTabId) window.izlix.snapshot(s.activeTabId).then((l: any) => useStore.getState().ingest(l)) }, [s.activeTabId])
  // yeni sekme sayfasi: URL'si olmayan (bos) sekmede (veya hic sekme yokken) shell DOM'undaki baslangic sayfasi gorunur
  const startVisible = !s.dashboard && (!active || (!active.url && !active.lab && !active.split))
  // overlay acikken sayfa gorunumleri (native katman) gizlenir, aksi halde shell'in ustunde kalirlardi
  const hidePages = s.overlay !== null || s.permPrompts.length > 0 || s.dashboard || startVisible || sugOpen || dragging
  const hideSeq = useRef(0)
  useEffect(() => {
    const api = window.izlix, seq = ++hideSeq.current
    if (!hidePages) { void api.setOverlay(false); const h = setTimeout(() => { if (hideSeq.current === seq) setFrozen(null) }, 160); return () => clearTimeout(h) }
    // dashboard/baslangic sayfasinda gosterilecek sayfa yok; digerlerinde once anlik goruntu alinip sonra gorunum gizlenir (sayfa kararmaz)
    if (s.dashboard || startVisible) { void api.setOverlay(true); setFrozen(null); return }
    void api.snapPage().catch(() => null).then((snap) => { if (hideSeq.current !== seq) return; setFrozen(snap); void api.setOverlay(true) })
  }, [hidePages, s.dashboard, startVisible])
  // adres cubugu: duzenlenmiyorsa aktif sekmenin URL'sini goster
  useEffect(() => { if (!editing) setAddr(active?.url ?? '') }, [active?.url, editing])
  // yerlesimi main surece bildir (WebContentsView sinirlari ayni hesapla belirlenir)
  const side: PanelSide = s.dock === 'off' ? s.panelSide : 'right' // Chrome DevTools aciksa panel her zaman sagda
  const targetRatio = s.panelOpen && !s.dashboard ? s.panelRatio : 0 // panel kapaliyken sayfa tam genislik
  const ratio = useTween(targetRatio, 240) // yumusak acilip kapanma
  const panelVisible = (s.panelOpen && !s.dashboard) || ratio > 0.005
  useEffect(() => { void window.izlix.setLayout({ dock: s.dock, panelRatio: Math.min(0.8, Math.max(0, ratio)), chromeHeight: Math.min(200, Math.max(40, Math.round(chromeH))), split: s.split === undefined ? undefined : Math.min(0.8, Math.max(0.2, s.split)), side, sideW: Math.min(400, Math.max(0, Math.round(sideW))) }) }, [s.dock, ratio, s.split, chromeH, side, sideW])

  const layout = computeLayout(size.w, size.h, { dock: s.dock, panelRatio: ratio, chromeHeight: chromeH, split: s.split, side, sideW })
  const setDock = (d: DevToolsDock): void => { writePref('dock', d); s.set({ dock: d }) }
  const api = window.izlix
  // Panel boyutlandirma: surukleme sirasinda native gorunumler gizlenir (aksi halde fare olaylarini yutarlar)
  const startDrag = (axis: 'x' | 'y' | 'b') => (e: React.PointerEvent): void => {
    e.preventDefault(); setDragging(true)
    const bodyH = size.h - chromeH
    const move = (ev: PointerEvent): void => {
      if (axis === 'x') s.set({ panelRatio: Math.min(0.8, Math.max(0.2, side === 'left' ? ev.clientX / size.w : 1 - ev.clientX / size.w)) })
      else if (axis === 'b') s.set({ panelRatio: Math.min(0.8, Math.max(0.2, 1 - (ev.clientY - chromeH) / bodyH)) })
      else s.set({ split: Math.min(0.8, Math.max(0.2, (ev.clientY - chromeH) / bodyH)) })
    }
    const up = (): void => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up)
      const st = useStore.getState(); writePref('panelRatio', String(+st.panelRatio.toFixed(3))); writePref('split', String(+st.split.toFixed(3)))
      setDragging(false)
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
  }
  const nav = (fn: (id: string) => unknown) => (): void => { if (active) void fn(active.id) }

  const cardTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const cardIn = (id: string, el: HTMLElement): void => {
    clearTimeout(cardTimer.current)
    cardTimer.current = setTimeout(() => { const r = el.getBoundingClientRect(); void api.tabCard(id, vertical ? r.right : r.left, vertical ? r.top : r.bottom, vertical ? 'right' : 'below') }, 450)
  }
  const cardOut = (): void => { clearTimeout(cardTimer.current); void api.tabCard(null) }
  const tabEl = (tb: (typeof s.tabs)[number]): React.ReactElement => (
          <div key={tb.id} draggable style={tb.group ? { ['--gc' as any]: GROUP_COLORS[s.groups.find((g) => g.id === tb.group)?.color ?? 'grey'] } : undefined} className={`tab nodrag ${tb.group ? 'grouped' : ''} ${tb.winId !== undefined && tb.winId !== s.winId ? 'away' : ''} ${tb.sleeping ? 'sleeping' : ''} ${tb.pinned ? 'pinned' : ''} ${tb.private ? `private ${tb.private}` : ''} ${tb.split ? 'split' : ''} ${tb.id === s.activeTabId ? 'active' : ''} ${dragTab === tb.id ? 'dragging' : ''} ${overTab === tb.id && dragTab !== tb.id ? 'dropping' : ''}`}
            onDragStart={(e) => { setDragTab(tb.id); e.dataTransfer.effectAllowed = 'move'; e.dataTransfer.setData('text/plain', tb.id) }}
            onDragOver={(e) => { if (dragTab) { e.preventDefault(); setOverTab(tb.id) } }}
            onDrop={(e) => { e.preventDefault(); if (dragTab && dragTab !== tb.id) { const idx = s.tabs.findIndex((x) => x.id === tb.id); void api.moveTab(dragTab, idx) } setDragTab(null); setOverTab(null) }}
            onDragEnd={() => { setDragTab(null); setOverTab(null) }} onMouseEnter={(e) => cardIn(tb.id, e.currentTarget)} onMouseLeave={cardOut} onClick={() => { cardOut(); void api.activateTab(tb.id) }} onContextMenu={(e) => { e.preventDefault(); void api.tabMenu(tb.id) }} title={tb.url}>
            <span className="t">{!tb.private && s.favicons[originKey(tb.url) ?? ''] && <img className="tab-fav" alt="" src={s.favicons[originKey(tb.url) ?? '']} />}{tb.private && <i className="priv-dot" title={t(tb.private === 'tor' ? 'tab.tor' : 'tab.private')} />}{tb.loading && <Spinner style={{ marginRight: 6, verticalAlign: -1 }} />}{!tb.title || tb.title === 'New Tab' ? t('tab.untitled') : tb.title}</span>
            {(tb.audible || tb.muted) && <button className={`tab-audio ${tb.muted ? 'muted' : ''}`} aria-label={t(tb.muted ? 'ctx.unmute' : 'ctx.mute')} title={t(tb.muted ? 'ctx.unmute' : 'ctx.mute')} onClick={(e) => { e.stopPropagation(); void api.muteTab(tb.id, !tb.muted) }}>{tb.muted ? <IcMuted /> : <IcSpeaker />}</button>}
            {!tb.pinned && <button className="tab-hop" aria-label={t('tab.hopTip')} title={t(tb.winId !== undefined && tb.winId !== s.winId ? 'tab.hopBack' : 'tab.hopTip')} onClick={(e) => { e.stopPropagation(); void api.hopTab(tb.id) }}><IcHop /></button>}
            {!tb.pinned && <button aria-label={t('tab.close')} onClick={(e) => { e.stopPropagation(); void api.closeTab(tb.id) }}><Close /></button>}
          </div>
  )
  const renderTabs = (): React.ReactNode[] => {
    const out: React.ReactNode[] = []
    let prev: string | undefined
    for (const tb of myTabs) {
      const g = tb.group ? s.groups.find((x) => x.id === tb.group) : undefined
      if (g && tb.group !== prev) out.push(<GroupChip key={`g-${g.id}`} g={g} count={myTabs.filter((x) => x.group === g.id).length} />)
      prev = tb.group
      if (g?.collapsed && tb.id !== s.activeTabId) continue // daraltilmis grup: yalniz aktif sekme gorunur
      out.push(tabEl(tb))
    }
    return out
  }
  return (
    <>
      {appWin ? (
        <div className="appbar drag">
          <button className="nodrag" aria-label={t('nav.back')} disabled={!active?.canGoBack} onClick={nav(api.back)}><Back /></button>
          <button className="nodrag" aria-label={t('nav.forward')} disabled={!active?.canGoForward} onClick={nav(api.forward)}><Forward /></button>
          <button className="nodrag" aria-label={t('nav.reload')} disabled={!active} onClick={nav(api.reload)}><Reload /></button>
          <span className="appbar-title">{active?.title && active.title !== 'New Tab' ? active.title : pageHost}</span>
          <span className="appbar-host">{pageHost}</span>
          {active && <button className="nodrag" aria-label={t('app.toBrowser')} title={t('app.toBrowser')} onClick={() => void api.hopTab(active.id)}><IcHop /></button>}
        </div>
      ) : (
      <>
      {vertical ? (
        <div className={`vside drag ${s.sideCollapsed ? 'collapsed' : ''}`} style={{ width: sideW }}>
          <div className="vside-sec">{!s.sideCollapsed && t('side.tabs')}</div>
          <div className="vside-list">{renderTabs()}</div>
          <div className="vside-foot nodrag">
            <button className="vnew" aria-label={t('tab.new')} onClick={() => api.createTab()}><Plus />{!s.sideCollapsed && <span>{t('tab.new')}</span>}</button>
            <button className="vcollapse" aria-label={t('side.collapse')} title={t('side.collapse')} onClick={() => { writePref('sideCollapsed', s.sideCollapsed ? '0' : '1'); s.set({ sideCollapsed: !s.sideCollapsed }) }}><Back style={{ transform: s.sideCollapsed ? 'rotate(180deg)' : undefined }} /></button>
          </div>
        </div>
      ) : (
        <div className="tabstrip drag">
          {renderTabs()}
          <button className="nodrag newtab" aria-label={t('tab.new')} onClick={() => api.createTab()}><Plus /></button>
        </div>
      )}

      <div className={`toolbar ${vertical ? 'drag' : ''}`} style={vertical ? { marginLeft: sideW } : undefined}>
        <button aria-label={t('nav.back')} disabled={!active?.canGoBack} onClick={nav(api.back)}><Back /></button>
        <button aria-label={t('nav.forward')} disabled={!active?.canGoForward} onClick={nav(api.forward)}><Forward /></button>
        <button aria-label={t('nav.reload')} disabled={!active} onClick={nav(api.reload)}><Reload /></button>
        <button aria-label={t('bookmark')} title={t('bookmark.title')} disabled={!active?.url} style={{ color: bookmarked ? 'var(--t-amber)' : undefined }} onClick={() => { if (active) void api.toggleBookmark(active.id).then((on: boolean) => toast(t(on ? 'toast.bookmarked' : 'toast.unbookmarked'))) }}><Star filled={bookmarked} /></button>
        <form style={{ flex: 1, display: 'flex' }} onSubmit={(e) => { e.preventDefault(); setTyped(null); if (active) void api.go(active.id, addr); (document.activeElement as HTMLElement)?.blur() }}>
 <input ref={addrRef} className="addr" value={addr} placeholder={t('addr.placeholder')} spellCheck={false} autoComplete="off"
            onFocus={(e) => { setEditing(true); e.target.select() }} onBlur={() => { setEditing(false); setTyped(null) }}
            onChange={(e) => {
              const v = e.target.value; setAddr(v); setTyped(v)
              if (((e.nativeEvent as InputEvent).inputType ?? '').startsWith('insert')) { const c = sg.complete(v); if (c) { setAddr(c); pendingSel.current = [v.length, c.length] } } // satir ici tamamlama: geri kalan secili
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') { setTyped(null); setAddr(active?.url ?? ''); (e.target as HTMLElement).blur(); return }
              if (!sugOpen) return
              if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = sg.items.length; sg.setIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n) }
              else if (e.key === 'Enter' && sg.idx > 0) { e.preventDefault(); pickSug(sg.items[sg.idx]) }
            }} />
          {nActive > 0 && (
            <button type="button" className="rule-badge nodrag" title={t('rules.badge.title')} onClick={() => s.set({ overlay: 'rules' })}>{t('rules.badge', { n: nActive })}</button>
          )}
        </form>
        {/^https?:/.test(active?.url ?? '') && active && (
          <>
            {active.site?.zoom && <button type="button" className="chip zoomchip nodrag" title={t('site.zoomReset')} onClick={() => void api.zoom(active.id, 'reset')}>{Math.round(active.site.zoom * 100)}%</button>}
            {!appWin && <BudgetChip />}
            {s.settings.focus?.on && <button type="button" className="chip focuschip nodrag" title={t('cmd.focusOff')} onClick={() => void api.setSettings({ focus: { ...s.settings.focus!, on: false } })}><i /><b>{t('focus.chip')}</b></button>}
            {s.speaking && <button type="button" className="chip speakchip nodrag" title={t('tts.stop')} onClick={() => void api.speak('stop')}><i /><b>{t('tts.speaking')}</b></button>}
            {s.replay.running && <button type="button" className="chip recchip nodrag" title={t('rec.stopReplay')} onClick={() => void api.recReplayStop()}><i /><b>REPLAY</b><Roll text={Object.keys(s.replay.states).length} /></button>}
            {s.rec.recording && <button type="button" className="chip recchip nodrag" title={t('rec.stop')} onClick={() => void api.recStop().then((steps: any) => s.set({ rec: { recording: false, tabId: null, steps }, overlay: 'recorder' }))}><i /><b>REC</b><Roll text={s.rec.steps.length} /></button>}
            {insecure && <span className="chip insecure nodrag" title={t('sec.insecureTip')}>{t('sec.insecure')}</span>}
            {active.translatedFrom
              ? <button type="button" className="chip transchip on nodrag" title={t('tr.showOriginal')} onClick={() => void api.translateTab(active.id, true)}>{t('tr.original')}</button>
              : active.lang && active.lang !== s.settings.language && <button type="button" className="chip transchip nodrag" title={t('tr.translate')} onClick={() => void api.translateTab(active.id)}>{t('tr.translate')}</button>}
            {!!active.logins && <button type="button" className="chip keybtn nodrag" title={t('pw.fill')} onClick={() => void api.pwFill(active.id)}><IcKey />{active.logins > 1 && <b>{active.logins}</b>}</button>}
            <button type="button" className={`chip sitebtn nodrag ${active.site?.dark ? 'on' : ''}`} title={t('site.title')} onClick={() => s.set({ overlay: 'site' })}><IcTune /></button>
          </>
        )}
        {shieldShown && active && (
          <button type="button" className={`chip shield nodrag ${adOff ? 'off' : ''}`} title={t(adOff ? 'ad.tipOff' : 'ad.tipOn', { n: active.blocked ?? 0 })} onClick={() => void api.adMenu(pageHost)}><IcShield />{!adOff && (active.blocked ?? 0) > 0 && <b><Roll text={active.blocked ?? 0} /></b>}</button>
        )}
        {emuActive(active?.emu) && active && (
          <button type="button" className="chip emu" title={t('emu.resetTip')} onClick={() => void api.setEmulation(active.id, { network: null, cpu: null, geo: null, ua: null, touch: null, vision: null, contrast: null, forcedColors: null, print: null })}>
            {[networkPreset(active.emu?.network)?.label, active.emu?.cpu ? `CPU ${active.emu.cpu}×` : '', geoPreset(active.emu?.geo)?.label, uaPreset(active.emu?.ua)?.label, active.emu?.touch ? 'touch' : '', active.emu?.vision ? t(`vis.${active.emu.vision}` as any) : '', active.emu?.contrast ? `contrast ${active.emu.contrast}` : '', active.emu?.forcedColors ? 'forced-colors' : '', active.emu?.print ? 'print' : ''].filter(Boolean).join(' · ')}<Close />
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
          <button className="chip" title={s.downloads.map((d) => `${d.name} (${d.state})`).join('\n')} onClick={() => s.set({ overlay: 'downloads' })}>
            <Download />{' '}{busyDl ? t('dl.busy', { n: busyDl }) : t('dl.count', { n: s.downloads.length })}
          </button>
        )}
        <Select aria-label={t('workspace')} value={s.activeWorkspaceId} onChange={(e) => { if (e.target.value === '__new') void api.createWorkspace('', null); else void api.switchWorkspace(e.target.value) }}>
          {s.workspaces.map((w) => <option key={w.id} value={w.id}>{wsName(w)}</option>)}
          <option value="__new">{t('ws.fromFolder')}</option>
        </Select>
        {s.detected.length > 0 && (
          <button className="chip srv-chip" title={s.detected.map((d) => `:${d.port} ${d.framework ?? ''}`).join('\n')} onClick={() => (s.detected.length === 1 ? api.createTab(`localhost:${s.detected[0].port}`) : s.set({ overlay: 'palette' }))}>
            <i className="dot" />{s.detected[0].port}{s.detected[0].framework ? ` ${s.detected[0].framework}` : ''}{s.detected.length > 1 ? <b>+{s.detected.length - 1}</b> : null}
          </button>
        )}
        <span className="tb-sep" />
        <button className={`tb-btn dash-btn ${s.dashboard ? 'on' : ''}`} aria-pressed={s.dashboard} title={`${t('dash.title')}  ⌥⌘D`} aria-label={t('dash.title')} onClick={() => s.set({ dashboard: !s.dashboard })}><IcOverview /></button>
        <button className={`tb-btn panel-toggle ${s.panelOpen && !s.dashboard ? 'on' : ''}`} aria-pressed={s.panelOpen && !s.dashboard} title={`${t('panel.toggle')}  ⌥⌘B`} aria-label={t('panel.toggle')} onClick={() => s.set({ panelOpen: !s.panelOpen, dashboard: false })}>{side === 'left' ? <IcDockL /> : side === 'bottom' ? <IcDockB /> : <IcPanel />}</button>
      </div>
      {s.bmBar && <BookmarkBar left={sideW} />}
      </>
      )}

      {active?.loading && <div className="load-bar" aria-hidden><i /></div>}
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
      {sugOpen && <SuggestList items={sg.items} idx={sg.idx} anchor={addrRef.current} query={typed ?? ''} onPick={pickSug} onHover={sg.setIdx} />}
      {frozen && !s.dashboard && !startVisible && (() => { const r = padRect(layout.page); return <div className="freeze" style={{ left: r.x, top: r.y, width: r.width, height: r.height }}><img alt="" draggable={false} src={frozen.url} style={{ width: frozen.w, height: frozen.h }} /></div> })()}
      {startVisible && <StartPage tabId={active?.id ?? null} style={{ left: padRect(layout.page).x, top: padRect(layout.page).y, width: padRect(layout.page).width, height: padRect(layout.page).height }} />}
      {panelVisible && <div className={`panel side-${side}`} style={{ left: padRect(layout.timeline).x, top: padRect(layout.timeline).y, width: padRect(layout.timeline).width, height: padRect(layout.timeline).height }}>
        <Timeline width={padRect(layout.timeline).width} height={padRect(layout.timeline).height} />
      </div>}
      {s.panelOpen && !s.dashboard && s.dock === 'right' && <div className="resizer-h nodrag" onPointerDown={startDrag('y')} style={{ left: layout.timeline.x, width: layout.timeline.width, top: layout.timeline.y + layout.timeline.height - 3 }} />}
      {s.panelOpen && !s.dashboard && side !== 'bottom' && <div className="resizer-v nodrag" onPointerDown={startDrag('x')} style={{ left: side === 'left' ? layout.timeline.x + layout.timeline.width - 3 : layout.timeline.x - 3, top: chromeH, height: layout.timeline.height }} />}
      {s.panelOpen && !s.dashboard && side === 'bottom' && <div className="resizer-h nodrag" onPointerDown={startDrag('b')} style={{ left: 0, width: size.w, top: layout.timeline.y - 3 }} />}
      {dragging && <div style={{ position: 'fixed', inset: 0, zIndex: 40, cursor: 'grabbing' }} />}
      {s.dashboard && <DashboardView top={chromeH} left={sideW} />}
      <Toasts />
      <PermissionPrompt />
      {s.overlay === 'session' && <SessionPrompt onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'marker' && <MarkerPrompt onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'shortcuts' && <Shortcuts onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'site' && active && <SiteSettings tabId={active.id} onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'recorder' && <RecorderDialog onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'qr' && active && <QrDialog tabId={active.id} onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'ai' && <AiDialog onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'hub' && <HubPage onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'usage' && <UsagePage onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'notePrompt' && s.noteAsk && <NotePrompt onClose={() => s.set({ overlay: null, noteAsk: null })} />}
      {s.overlay === 'notes' && <NotesPage onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'downloads' && <DownloadsPage onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'tabsearch' && <TabSearch onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'bookmarks' && <BookmarkManager onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'history' && <HistoryPage onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'settings' && <Settings onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'rename' && <RenameWorkspace onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'welcome' && <Welcome onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'palette' && <Palette onClose={() => s.set({ overlay: null })} />}
      {s.overlay === 'rules' && <RulesPanel onClose={() => s.set({ overlay: null })} />}
    </>
  )
}
