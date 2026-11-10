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
  exportReport: () => call(Ch.reportExport),
  setOverlay: (open: boolean) => call(Ch.overlay, { open }),
  onRules: sub(Ch.rulesState), onCommand: sub(Ch.cmd),
  onEvent: sub(Ch.evNew), onUpdate: sub(Ch.evUpdate), onTabs: sub(Ch.tabsState), onWorkspaces: sub(Ch.wsState)
}
contextBridge.exposeInMainWorld('izlix', api)
export type Api = typeof api
