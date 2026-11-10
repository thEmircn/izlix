import { useStore, writePref, tNow as t } from './store'
import type { DevToolsDock } from '../shared/events'
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
    { id: 'report.make', title: t('cmd.report'), run: () => { void api.track('report.export'); void api.exportReport() } },
    { id: 'snapshot.save', title: t('cmd.snapshot'), run: () => active && void api.saveSnapshot(active.id) },
    { id: 'ws.rename', title: t('cmd.wsRename'), run: () => s.set({ overlay: 'rename' }) },
    ...(s.activeWorkspaceId !== 'default' ? [{ id: 'ws.delete', title: t('cmd.wsDelete'), run: () => void api.deleteWorkspace(s.activeWorkspaceId) }] : []),
    { id: 'find.open', title: t('cmd.find'), hint: '⌘F', run: () => s.set({ find: { open: true, active: 0, total: 0 } }) },
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
    cmds.push({ id: `tab:${tb.id}`, title: t('cmd.tab', { t: tb.title || 'New Tab' }), hint: tb.url, run: () => void api.activateTab(tb.id) })
  }
  for (const w of s.workspaces) {
    cmds.push({ id: `ws:${w.id}`, title: t('cmd.workspace', { w: w.name }), hint: w.id === s.activeWorkspaceId ? 'active' : w.rootDir ?? '', run: () => void api.switchWorkspace(w.id) })
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
