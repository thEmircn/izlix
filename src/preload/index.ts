import { contextBridge, ipcRenderer } from 'electron'
import { Ch } from '../shared/channels'

// Shell'e acilan tek yuzey. Sayfa gorunumlerine preload VERILMEZ.
const sub = (channel: string) => (cb: (payload: any) => void) => {
  const h = (_: unknown, p: unknown): void => cb(p)
  ipcRenderer.on(channel, h)
  return () => { ipcRenderer.removeListener(channel, h) }
}
const call = (channel: string, arg?: unknown) => ipcRenderer.invoke(channel, arg)

export const api = {
  createTab: (url?: string) => call(Ch.tabsCreate, { url }),
  closeTab: (id: string) => call(Ch.tabsClose, { id }),
  activateTab: (id: string) => call(Ch.tabsActivate, { id }),
  go: (id: string, input: string) => call(Ch.navGo, { id, input }),
  back: (id: string) => call(Ch.navBack, { id }),
  forward: (id: string) => call(Ch.navForward, { id }),
  reload: (id: string) => call(Ch.navReload, { id }),
  setLayout: (p: { dock: string; panelRatio: number; chromeHeight: number }) => call(Ch.layoutSet, p),
  snapshot: (id: string) => call(Ch.snapshot, { id }),
  openSource: (r: { file: string; line: number; column?: number; editor?: string }) => call(Ch.sourceOpen, r),
  createWorkspace: (name: string, rootDir: string | null) => call(Ch.wsCreate, { name, rootDir }),
  switchWorkspace: (id: string) => call(Ch.wsSwitch, { id }),
  setRules: (wsId: string, cfg: { rules: unknown[]; domains: string[] }) => call(Ch.rulesSet, { wsId, ...cfg }),
  history: () => call(Ch.libHistory),
  toggleBookmark: (id: string) => call(Ch.bookmarkToggle, { id }),
  showDownload: (id: string) => call(Ch.downloadShow, { id }),
  onLibrary: sub(Ch.libState),
  getSettings: () => call(Ch.settingsGet),
  setSettings: (p: { telemetry?: string; onboarded?: boolean; language?: string }) => call(Ch.settingsSet, p),
  track: (name: string, props?: Record<string, string | number | boolean>) => call(Ch.track, { name, props }),
  openDemo: () => call(Ch.demoOpen),
  onSettings: sub(Ch.settingsState),
  setMedia: (id: string, colorScheme: 'light' | 'dark' | null, reducedMotion: boolean) => call(Ch.mediaSet, { id, colorScheme, reducedMotion }),
  setLab: (id: string, devices: string[] | null) => call(Ch.labSet, { id, devices }),
  inspectTree: (id: string) => call(Ch.inspTree, { id }),
  inspectNode: (id: string, node: number, t: number | undefined, name: string) => call(Ch.inspNode, { id, node, t, name }),
  exportReport: () => call(Ch.reportExport),
  setOverlay: (open: boolean) => call(Ch.overlay, { open }),
  onRules: sub(Ch.rulesState), onCommand: sub(Ch.cmd),
  onEvent: sub(Ch.evNew), onUpdate: sub(Ch.evUpdate), onTabs: sub(Ch.tabsState), onWorkspaces: sub(Ch.wsState)
}
contextBridge.exposeInMainWorld('izlix', api)
export type Api = typeof api
