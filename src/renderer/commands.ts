import { PANEL_TABS, wsName, useStore, writePref, tNow as t, toast } from './store'
import type { DevToolsDock } from '../shared/events'
import { CPU_RATES, GEO_PRESETS, NETWORK_PRESETS, UA_PRESETS, VISION } from '../shared/emulation'
import { DEVICES, MAX_VIEWPORTS, deviceById } from '../shared/lab'

export interface Command { id: string; title: string; hint?: string; run(): void }

/** Command Palette komut listesi: eylemler, sekmeler, Workspace'ler, algılanan sunucular, kurallar, Lab (plan #9). */
export function buildCommands(): Command[] {
  const s = useStore.getState()
  const api = window.izlix
  const active = s.tabs.find((x) => x.id === s.activeTabId)
  const closeOverlay = (): void => s.set({ overlay: null })
  const lang = s.settings.language
  const cmds: Command[] = [
    { id: 'tab.new', title: t('cmd.newTab'), hint: '⌘T', run: () => void api.createTab() },
    { id: 'tab.reopen', title: t('cmd.reopen'), hint: '⇧⌘T', run: () => void api.reopenTab() },
    { id: 'tab.close', title: t('cmd.closeTab'), hint: '⌘W', run: () => active && void api.closeTab(active.id) },
    { id: 'nav.reload', title: t('cmd.reload'), hint: '⌘R', run: () => active && void api.reload(active.id) },
    { id: 'nav.back', title: t('cmd.back'), run: () => active && void api.back(active.id) },
    { id: 'nav.forward', title: t('cmd.forward'), run: () => active && void api.forward(active.id) },
    { id: 'addr.focus', title: t('cmd.focusAddr'), hint: '⌘L', run: () => { setTimeout(() => (document.querySelector('.addr') as HTMLInputElement | null)?.focus(), 0) } },
    { id: 'rules.open', title: t('cmd.rules'), hint: '⇧⌘R', run: () => s.set({ overlay: 'rules' }) },
    { id: 'ws.new', title: t('cmd.wsNew'), run: () => void api.createWorkspace('', null) },
    { id: 'tl.clear', title: t('cmd.tlClear'), run: () => s.set({ selectedEventId: null }) },
    { id: 'bookmark.toggle', title: t('cmd.bookmark'), hint: '⌘D', run: () => active && void api.toggleBookmark(active.id) },
    { id: 'report.make', title: t('cmd.report'), run: () => { void api.track('report.export'); void api.exportReport().then((p: string | null) => { if (p) toast(t('toast.report', { p: p.split('/').pop() ?? p })) }) } },
    { id: 'snapshot.open', title: t('cmd.openSnapshot'), run: () => void api.openSnapshot().then((r: any) => { if (r?.events) s.set({ snapshot: r, selectedEventId: null, panelTab: 'timeline' }) }) },
    { id: 'snapshot.save', title: t('cmd.snapshot'), run: () => { if (active) void api.saveSnapshot(active.id).then((p: string) => toast(t('toast.snapshot', { p: p.split('/').pop() ?? p }))) } },
    { id: 'ws.rename', title: t('cmd.wsRename'), run: () => s.set({ overlay: 'rename' }) },
    ...(s.activeWorkspaceId !== 'default' ? [{ id: 'ws.delete', title: t('cmd.wsDelete'), run: () => void api.deleteWorkspace(s.activeWorkspaceId) }] : []),
    { id: 'find.open', title: t('cmd.find'), hint: '⌘F', run: () => s.set({ find: { open: true, active: 0, total: 0 } }) },
    { id: 'autoopen', title: t(s.settings.autoOpen ? 'cmd.autoOpenOff' : 'cmd.autoOpenOn'), run: () => void api.setSettings({ autoOpen: !s.settings.autoOpen }) },
    { id: 'react.flash', title: t('tl.reactHl') + (s.flash ? ' (on)' : ''), run: () => { if (active) void api.flashRenders(active.id, !s.flash).then((on: boolean | null) => s.set({ flash: !!on })) } },
    { id: 'shortcuts', title: t('cmd.shortcuts'), hint: '⌘/', run: () => s.set({ overlay: 'shortcuts' }) },
    { id: 'srv.start', title: t('cmd.srvStart'), run: () => { s.set({ panelTab: 'server' }); void api.serverInfo(s.activeWorkspaceId).then((i: any) => { const sc = i?.scripts?.find((x: any) => x.likely) ?? i?.scripts?.[0]; if (sc) void api.serverStart(s.activeWorkspaceId, sc.name) }) } },
    { id: 'srv.stop', title: t('cmd.srvStop'), run: () => void api.serverStop(s.activeWorkspaceId) },
    { id: 'marker', title: t('cmd.marker'), hint: '⇧⌘M', run: () => s.set({ overlay: 'marker' }) },
    { id: 'settings', title: t('cmd.settings'), hint: '⌘,', run: () => s.set({ overlay: 'settings' }) },
    { id: 'demo.open', title: t('cmd.demo'), run: () => void api.openDemo() },
    { id: 'welcome.show', title: t('cmd.welcome'), run: () => s.set({ overlay: 'welcome' }) },
    { id: 'lang.switch', title: t('cmd.language', { lang: lang === 'en' ? 'Türkçe' : 'English' }), run: () => void api.setSettings({ language: lang === 'en' ? 'tr' : 'en' }) },
    s.settings.telemetry === 'granted'
      ? { id: 'telemetry.off', title: t('cmd.telemetryOff'), run: () => void api.setSettings({ telemetry: 'denied' }) }
      : { id: 'telemetry.on', title: t('cmd.telemetryOn'), run: () => void api.setSettings({ telemetry: 'granted' }) }
  ]
  // Paneller: Timeline/DevTools bolunmesi ve yan panel genisligi (kalici)
  const clamp = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, +v.toFixed(2)))
  const setPanel = (k: 'split' | 'panelRatio', v: number): void => { writePref(k, String(v)); s.set({ [k]: v } as any) }
  cmds.push(
    { id: 'panel.tlTaller', title: t('cmd.tlTaller'), run: () => setPanel('split', clamp(s.split + 0.1, 0.2, 0.8)) },
    { id: 'panel.tlShorter', title: t('cmd.tlShorter'), run: () => setPanel('split', clamp(s.split - 0.1, 0.2, 0.8)) },
    { id: 'panel.wider', title: t('cmd.panelWider'), run: () => setPanel('panelRatio', clamp(s.panelRatio + 0.1, 0.2, 0.8)) },
    { id: 'panel.narrower', title: t('cmd.panelNarrower'), run: () => setPanel('panelRatio', clamp(s.panelRatio - 0.1, 0.2, 0.8)) }
  )
  // Emulasyon (P3): tema ve azaltilmis hareket
  const media = active?.media
  const setMedia = (cs: 'light' | 'dark' | null, rm: boolean): void => { if (active) void api.setMedia(active.id, cs, rm) }
  cmds.push(
    { id: 'emu.dark', title: t('cmd.emuDark'), run: () => setMedia('dark', !!media?.reducedMotion) },
    { id: 'emu.light', title: t('cmd.emuLight'), run: () => setMedia('light', !!media?.reducedMotion) },
    { id: 'emu.motion', title: media?.reducedMotion ? t('cmd.emuMotionOff') : t('cmd.emuMotionOn'), run: () => setMedia(media?.colorScheme ?? null, !media?.reducedMotion) }
  )
  if (media) cmds.push({ id: 'emu.reset', title: t('cmd.emuReset'), run: () => setMedia(null, false) })
  // Ekran goruntusu
  const shot = (kind: 'viewport' | 'full', copy: boolean): void => {
    if (!active) return
    void api.screenshot(active.id, kind, { copy }).then(async (r: any) => {
      if (!r) return toast(t('toast.shotFail'))
      if (r.b64) {
        try { const blob = await (await fetch(`data:image/png;base64,${r.b64}`)).blob(); await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]); toast(t('toast.shotCopied')) } catch { toast(t('toast.shotFail')) }
      } else toast(t('toast.shot', { p: String(r.path).split('/').pop() ?? '' }))
    })
  }
  cmds.push(
    { id: 'shot.view', title: t('cmd.shotView'), run: () => shot('viewport', false) }, { id: 'shot.full', title: t('cmd.shotFull'), run: () => shot('full', false) },
    { id: 'shot.viewCopy', title: t('cmd.shotCopy'), run: () => shot('viewport', true) }, { id: 'shot.fullCopy', title: t('cmd.shotFullCopy'), run: () => shot('full', true) }
  )
  // Ag/CPU kisitlama ve konum emulasyonu
  const emu = active?.emu
  const setEmu = (p: Parameters<typeof api.setEmulation>[1]): void => { if (active) void api.setEmulation(active.id, p) }
  for (const n of NETWORK_PRESETS) cmds.push({ id: `net.${n.id}`, title: t('cmd.net', { p: n.label }), hint: emu?.network === n.id ? 'active' : '', run: () => setEmu({ network: n.id }) })
  if (emu?.network) cmds.push({ id: 'net.off', title: t('cmd.netOff'), run: () => setEmu({ network: null }) })
  for (const r of CPU_RATES.filter((x) => x > 1)) cmds.push({ id: `cpu.${r}`, title: t('cmd.cpu', { r }), hint: emu?.cpu === r ? 'active' : '', run: () => setEmu({ cpu: r }) })
  if (emu?.cpu) cmds.push({ id: 'cpu.off', title: t('cmd.cpuOff'), run: () => setEmu({ cpu: null }) })
  for (const g of GEO_PRESETS) cmds.push({ id: `geo.${g.id}`, title: t('cmd.geo', { p: g.label }), hint: emu?.geo === g.id ? 'active' : g.locale, run: () => setEmu({ geo: g.id }) })
  if (emu?.geo) cmds.push({ id: 'geo.off', title: t('cmd.geoOff'), run: () => setEmu({ geo: null }) })
  for (const u of UA_PRESETS) cmds.push({ id: `ua.${u.id}`, title: t('cmd.ua', { p: u.label }), hint: emu?.ua === u.id ? 'active' : '', run: () => setEmu({ ua: u.id }) })
  if (emu?.ua) cmds.push({ id: 'ua.off', title: t('cmd.uaOff'), run: () => setEmu({ ua: null }) })
  cmds.push({ id: 'emu.touch', title: emu?.touch ? t('cmd.touchOff') : t('cmd.touchOn'), run: () => setEmu({ touch: !emu?.touch }) })
  for (const v of VISION) cmds.push({ id: `vis.${v}`, title: t('cmd.vision', { p: t(`vis.${v}` as any) }), hint: emu?.vision === v ? 'active' : '', run: () => setEmu({ vision: v }) })
  if (emu?.vision) cmds.push({ id: 'vis.off', title: t('cmd.visionOff'), run: () => setEmu({ vision: null }) })
  cmds.push({ id: 'emu.contrastMore', title: t('cmd.contrastMore'), hint: emu?.contrast === 'more' ? 'active' : '', run: () => setEmu({ contrast: emu?.contrast === 'more' ? null : 'more' }) })
  cmds.push({ id: 'emu.forced', title: emu?.forcedColors ? t('cmd.forcedOff') : t('cmd.forcedOn'), run: () => setEmu({ forcedColors: !emu?.forcedColors }) })
  cmds.push({ id: 'emu.print', title: emu?.print ? t('cmd.printOff') : t('cmd.printOn'), run: () => setEmu({ print: !emu?.print }) })
  // Panel sekmeleri
  const PANEL_NAMES = Object.fromEntries(PANEL_TABS.map((k) => [k, t(`tl.${k}` as any)])) as Record<string, string>
  PANEL_TABS.forEach((k, i) => cmds.push({ id: `panel.${k}`, title: t('cmd.panel', { n: PANEL_NAMES[k] }), hint: i < 9 ? `⌥⌘${i + 1}` : '', run: () => s.set({ panelTab: k }) }))
  // Responsive Lab (#7)
  const lab = active?.lab
  const setLab = (ids: string[] | null): void => { if (active) { if (ids) void api.track('lab.start'); void api.setLab(active.id, ids) } }
  if (!lab) {
    cmds.push({ id: 'lab.start', title: t('cmd.labStart'), run: () => setLab(['iphone-se', 'ipad-mini', 'laptop']) })
    for (const d of DEVICES) cmds.push({ id: `lab.start.${d.id}`, title: t('cmd.labStartWith', { d: d.label }), hint: `${d.width}×${d.height}`, run: () => setLab([d.id]) })
  } else {
    cmds.push({ id: 'lab.exit', title: t('cmd.labExit'), run: () => setLab(null) })
    if (lab.length < MAX_VIEWPORTS) for (const d of DEVICES) cmds.push({ id: `lab.add.${d.id}`, title: t('cmd.labAdd', { d: d.label }), hint: `${d.width}×${d.height}`, run: () => setLab([...lab, d.id]) })
    lab.forEach((id, i) => cmds.push({ id: `lab.rm.${i}`, title: t('cmd.labRemove', { d: `${deviceById(id)?.label ?? id}${lab.filter((x) => x === id).length > 1 ? ` (#${i + 1})` : ''}` }), run: () => setLab(lab.length > 1 ? lab.filter((_, j) => j !== i) : null) }))
  }
  for (const d of ['right', 'bottom', 'off'] as DevToolsDock[]) {
    cmds.push({ id: `dock.${d}`, title: d === 'off' ? t('cmd.dockHide') : t('cmd.dockAt', { pos: d }), run: () => { writePref('dock', d); s.set({ dock: d }) } })
  }
  for (const tb of s.tabs.filter((x) => x.workspaceId === s.activeWorkspaceId)) {
    cmds.push({ id: `tab:${tb.id}`, title: t('cmd.tab', { t: !tb.title || tb.title === 'New Tab' ? t('tab.untitled') : tb.title }), hint: tb.url, run: () => void api.activateTab(tb.id) })
  }
  for (const sd of ['left', 'bottom', 'right'] as const) cmds.push({ id: `panel.side.${sd}`, title: t('cmd.panelSide', { p: t(`panel.side.${sd}` as any) }), hint: s.panelSide === sd ? 'active' : '', run: () => s.set({ panelSide: sd, panelOpen: true, dashboard: false }) })
  cmds.push({ id: 'panel.expand', title: t('panel.expand'), run: () => { const r = s.panelRatio > 0.6 ? 0.4 : 0.8; writePref('panelRatio', String(r)); s.set({ panelRatio: r, panelOpen: true }) } })
  cmds.push({ id: 'panel.toggle', title: t('cmd.panelToggle'), hint: '⌥⌘B', run: () => s.set({ panelOpen: !s.panelOpen, dashboard: false }) })
  cmds.push({ id: 'dashboard.toggle', title: t('cmd.dashToggle'), hint: '⌥⌘D', run: () => s.set({ dashboard: !s.dashboard }) })
  // Oturumlar
  cmds.push({ id: 'session.save', title: t('cmd.sessSave'), run: () => s.set({ overlay: 'session' }) })
  for (const x of s.sessions[s.activeWorkspaceId] ?? []) {
    cmds.push({ id: `sess.open.${x.id}`, title: t('cmd.sessOpen', { n: x.name }), hint: t('sess.tabs', { n: x.tabs.length }), run: () => void api.openSession(x.id) })
    cmds.push({ id: `sess.replace.${x.id}`, title: t('cmd.sessReplace', { n: x.name }), hint: t('sess.tabs', { n: x.tabs.length }), run: () => void api.openSession(x.id, true) })
    cmds.push({ id: `sess.del.${x.id}`, title: t('cmd.sessDelete', { n: x.name }), run: () => void api.deleteSession(x.id) })
  }
  // Bolunmus gorunum (Split View)
  const act = s.tabs.find((x) => x.id === s.activeTabId)
  if (act && !act.lab) {
    for (const tb of s.tabs.filter((x) => x.workspaceId === s.activeWorkspaceId && x.id !== act.id && !x.lab && x.split !== (act.split === 'left' ? 'right' : 'left'))) {
      cmds.push({ id: `split:${tb.id}`, title: t('cmd.splitWith', { t: !tb.title || tb.title === 'New Tab' ? t('tab.untitled') : tb.title }), hint: tb.url, run: () => void api.splitTab(tb.id) })
    }
    cmds.push({ id: 'split.new', title: t('cmd.splitNew'), run: () => { void (async () => { const before = act.id; const nid = (await api.createTab()) as string; await api.activateTab(before); await api.splitTab(nid) })() } })
    if (act.split) cmds.push({ id: 'split.close', title: t('cmd.splitClose'), run: () => void api.splitTab(null) })
  }
  for (const w of s.workspaces) {
    cmds.push({ id: `ws:${w.id}`, title: t('cmd.workspace', { w: wsName(w) }), hint: w.id === s.activeWorkspaceId ? 'active' : w.rootDir ?? '', run: () => void api.switchWorkspace(w.id) })
  }
  for (const b of s.bookmarks[s.activeWorkspaceId] ?? []) cmds.push({ id: `bm:${b.url}`, title: t('cmd.bookmarkItem', { t: b.title }), hint: b.url, run: () => void api.createTab(b.url) })
  for (const d of s.downloads.slice().reverse()) cmds.push({ id: `dl:${d.id}`, title: t('cmd.download', { t: d.name }), hint: d.state === 'progressing' && d.total ? `${Math.round((d.received / d.total) * 100)}%` : d.state, run: () => void api.showDownload(d.id) })
  for (const d of s.detected) {
    cmds.push({ id: `srv:${d.port}`, title: t('cmd.openServer', { port: d.port, fw: d.framework ? ` (${d.framework})` : '' }), hint: d.cwd ?? '', run: () => void api.createTab(`localhost:${d.port}`) })
  }
  const cfg = s.rules[s.activeWorkspaceId]
  for (const r of cfg?.rules ?? []) {
    cmds.push({
      id: `rule:${r.id}`, title: t(r.enabled ? 'cmd.ruleOff' : 'cmd.ruleOn', { n: r.name }), hint: r.action.type,
      run: () => void api.setRules(s.activeWorkspaceId, { ...cfg, rules: cfg.rules.map((x) => x.id === r.id ? { ...x, enabled: !x.enabled } : x) })
    })
  }
  return cmds.map((c) => ({ ...c, run: () => { closeOverlay(); c.run() } }))
}
