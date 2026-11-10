import { useStore, writePref } from './store'
import type { DevToolsDock } from '../shared/events'
import { DEVICES, MAX_VIEWPORTS, deviceById } from '../shared/lab'

export interface Command { id: string; title: string; hint?: string; run(): void }

/** Command Palette komut listesi: eylemler, sekmeler, Workspace'ler, algılanan sunucular, kurallar (plan #9). */
export function buildCommands(): Command[] {
  const s = useStore.getState()
  const api = window.izlix
  const active = s.tabs.find((t) => t.id === s.activeTabId)
  const closeOverlay = (): void => s.set({ overlay: null })
  const cmds: Command[] = [
    { id: 'tab.new', title: 'New Tab', hint: '⌘T', run: () => void api.createTab() },
    { id: 'tab.close', title: 'Close Tab', hint: '⌘W', run: () => active && void api.closeTab(active.id) },
    { id: 'nav.reload', title: 'Reload Page', hint: '⌘R', run: () => active && void api.reload(active.id) },
    { id: 'nav.back', title: 'Go Back', run: () => active && void api.back(active.id) },
    { id: 'nav.forward', title: 'Go Forward', run: () => active && void api.forward(active.id) },
    { id: 'addr.focus', title: 'Focus Address Bar', hint: '⌘L', run: () => { setTimeout(() => (document.querySelector('.addr') as HTMLInputElement | null)?.focus(), 0) } },
    { id: 'rules.open', title: 'Request Rules: Edit…', hint: '⇧⌘R', run: () => s.set({ overlay: 'rules' }) },
    { id: 'ws.new', title: 'Workspace: New from Folder…', run: () => void api.createWorkspace('', null) },
    { id: 'tl.clear', title: 'Timeline: Clear Selection', run: () => s.set({ selectedEventId: null }) },
    { id: 'bookmark.toggle', title: 'Bookmark: Toggle This Page', hint: '⌘D', run: () => active && void api.toggleBookmark(active.id) },
    { id: 'report.make', title: 'Bug Report: Export zip', run: () => void api.exportReport() }
  ]
  // Responsive Lab (#7)
  const lab = active?.lab
  const setLab = (ids: string[] | null): void => { if (active) void api.setLab(active.id, ids) }
  if (!lab) {
    cmds.push({ id: 'lab.start', title: 'Responsive Lab: Start (iPhone SE + iPad mini + Laptop)', run: () => setLab(['iphone-se', 'ipad-mini', 'laptop']) })
    for (const d of DEVICES) cmds.push({ id: `lab.start.${d.id}`, title: `Responsive Lab: Start with ${d.label}`, hint: `${d.width}×${d.height}`, run: () => setLab([d.id]) })
  } else {
    cmds.push({ id: 'lab.exit', title: 'Responsive Lab: Exit', run: () => setLab(null) })
    if (lab.length < MAX_VIEWPORTS) for (const d of DEVICES) cmds.push({ id: `lab.add.${d.id}`, title: `Responsive Lab: Add ${d.label}`, hint: `${d.width}×${d.height}`, run: () => setLab([...lab, d.id]) })
    lab.forEach((id, i) => cmds.push({ id: `lab.rm.${i}`, title: `Responsive Lab: Remove ${deviceById(id)?.label ?? id}${lab.filter((x) => x === id).length > 1 ? ` (#${i + 1})` : ''}`, run: () => setLab(lab.length > 1 ? lab.filter((_, j) => j !== i) : null) }))
  }
  for (const d of ['right', 'bottom', 'off'] as DevToolsDock[]) {
    cmds.push({ id: `dock.${d}`, title: `DevTools: ${d === 'off' ? 'Hide' : 'Dock ' + d}`, run: () => { writePref('dock', d); s.set({ dock: d }) } })
  }
  for (const t of s.tabs.filter((x) => x.workspaceId === s.activeWorkspaceId)) {
    cmds.push({ id: `tab:${t.id}`, title: `Tab: ${t.title || 'New Tab'}`, hint: t.url, run: () => void api.activateTab(t.id) })
  }
  for (const w of s.workspaces) {
    cmds.push({ id: `ws:${w.id}`, title: `Workspace: ${w.name}`, hint: w.id === s.activeWorkspaceId ? 'active' : w.rootDir ?? '', run: () => void api.switchWorkspace(w.id) })
  }
  for (const b of s.bookmarks[s.activeWorkspaceId] ?? []) cmds.push({ id: `bm:${b.url}`, title: `Bookmark: ${b.title}`, hint: b.url, run: () => void api.createTab(b.url) })
  for (const d of s.downloads.slice().reverse()) cmds.push({ id: `dl:${d.id}`, title: `Download: ${d.name}`, hint: d.state === 'progressing' && d.total ? `${Math.round((d.received / d.total) * 100)}%` : d.state, run: () => void api.showDownload(d.id) })
  for (const d of s.detected) {
    cmds.push({ id: `srv:${d.port}`, title: `Open localhost:${d.port}${d.framework ? ' (' + d.framework + ')' : ''}`, hint: d.cwd ?? '', run: () => void api.createTab(`localhost:${d.port}`) })
  }
  const cfg = s.rules[s.activeWorkspaceId]
  for (const r of cfg?.rules ?? []) {
    cmds.push({
      id: `rule:${r.id}`, title: `Rule: ${r.enabled ? 'Disable' : 'Enable'} “${r.name}”`, hint: r.action.type,
      run: () => void api.setRules(s.activeWorkspaceId, { ...cfg, rules: cfg.rules.map((x) => x.id === r.id ? { ...x, enabled: !x.enabled } : x) })
    })
  }
  return cmds.map((c) => ({ ...c, run: () => { closeOverlay(); c.run() } }))
}
