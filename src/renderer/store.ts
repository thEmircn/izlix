import { create } from 'zustand'
import type { RulesConfig } from '../shared/rules'
import type { BusEvent, DevToolsDock, Editor, Language, Settings, TabInfo, WorkspaceInfo } from '../shared/events'
import { translate, type Key } from '../shared/i18n'

export type PanelTab = 'timeline' | 'network' | 'console' | 'elements' | 'sources' | 'storage' | 'perf' | 'coverage' | 'a11y' | 'profiler' | 'seo' | 'server' | 'components' | 'renders' | 'raw'
export const PANEL_TABS: PanelTab[] = ['timeline', 'network', 'console', 'elements', 'sources', 'storage', 'perf', 'coverage', 'a11y', 'profiler', 'seo', 'server', 'components', 'renders', 'raw']

interface State {
  tabs: TabInfo[]; activeTabId: string | null; dock: DevToolsDock
  workspaces: WorkspaceInfo[]; activeWorkspaceId: string; detected: { port: number; cwd: string | null; framework?: string }[]
  events: Map<number, BusEvent>
  selectedEventId: number | null
  editor: Editor
  panelRatio: number
  split: number
  rules: Record<string, RulesConfig>
  bookmarks: Record<string, { url: string; title: string }[]>
  downloads: { id: string; name: string; received: number; total: number; state: string }[]
  panelTab: PanelTab
  flash: boolean
  /** Debugger: kesme noktalari (sekme bazli) ve duraklama durumu */
  bps: { tabId: string; kind: 'file' | 'url'; target: string; line: number; condition?: string; bpId?: string }[]
  paused: { tabId: string; reason: string; frames: any[]; sel: number } | null
  /** Sources'a gitme istegi (konsol stack'i vb.): betik URL'si ve uretilen konum */
  sourceTarget: { url: string; line: number; col: number } | null
  /** salt okunur anlik goruntu incelemesi (canli olaylarin yerine gecer) */
  snapshot: { name: string; events: BusEvent[] } | null
  permPrompts: { id: string; origin: string; permission: string }[]
  preserveLog: boolean
  toasts: { id: number; text: string }[]
  find: { open: boolean; active: number; total: number }
  overlay: 'palette' | 'rules' | 'welcome' | 'rename' | 'settings' | 'shortcuts' | 'marker' | null
  settings: Settings
  set(p: Partial<State>): void
  ingest(batch: BusEvent[]): void
  reset(list: BusEvent[]): void
}

const read = (k: string, d: string): string => { try { return localStorage.getItem(k) ?? d } catch { return d } }
export const writePref = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* yok say */ } }
const MAX = 5000

export const useStore = create<State>((set) => ({
  tabs: [], activeTabId: null, dock: (read('dock', 'off') as DevToolsDock), workspaces: [], activeWorkspaceId: 'default', detected: [],
  events: new Map(), selectedEventId: null,
  editor: read('editor', 'vscode') as Editor, panelRatio: Number(read('panelRatio', '0.4')), split: Number(read('split', '0.52')),
  rules: {}, bookmarks: {}, downloads: [], overlay: null, panelTab: (PANEL_TABS.includes(read('panelTab', 'timeline') as PanelTab) ? read('panelTab', 'timeline') : 'timeline') as PanelTab, flash: false, bps: [], paused: null, sourceTarget: null, snapshot: null, permPrompts: [], preserveLog: read('preserveLog', '1') === '1', toasts: [], find: { open: false, active: 0, total: 0 }, settings: { telemetry: 'unset', onboarded: true, language: 'en', installId: '', autoOpen: false },
  set: (p) => { if (p.panelTab) writePref('panelTab', p.panelTab); set(p) },
  ingest: (batch) => set((s) => {
    const next = new Map(s.events)
    for (const e of batch) next.set(e.id, e)
    if (next.size > MAX) for (const k of [...next.keys()].slice(0, next.size - MAX)) next.delete(k)
    return { events: next }
  }),
  reset: (list) => set({ events: new Map(list.map((e) => [e.id, e])), selectedEventId: null })
}))

type Vars = Record<string, string | number>
/** React icinde dil degisince yeniden cizim icin hook */
export const useT = (): ((k: Key, v?: Vars) => string) => {
  const lang = useStore((s) => s.settings.language)
  return (k, v) => translate(lang, k, v)
}
/** React disi baglamlar (komutlar) */
export const tNow = (k: Key, v?: Vars): string => translate(useStore.getState().settings.language as Language, k, v)

let toastSeq = 0
/** Kisa omurlu bildirim (3 sn) */
export const toast = (text: string): void => {
  const id = ++toastSeq
  useStore.setState((s) => ({ toasts: [...s.toasts.slice(-3), { id, text }] }))
  setTimeout(() => useStore.setState((s) => ({ toasts: s.toasts.filter((x) => x.id !== id) })), 3200)
}
