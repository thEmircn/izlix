import { create } from 'zustand'
import type { RulesConfig } from '../shared/rules'
import type { BusEvent, DevToolsDock, Editor, Language, Settings, TabInfo, WorkspaceInfo } from '../shared/events'
import { translate, type Key } from '../shared/i18n'

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
  find: { open: boolean; active: number; total: number }
  overlay: 'palette' | 'rules' | 'welcome' | 'rename' | null
  settings: Settings
  set(p: Partial<State>): void
  ingest(batch: BusEvent[]): void
  reset(list: BusEvent[]): void
}

const read = (k: string, d: string): string => { try { return localStorage.getItem(k) ?? d } catch { return d } }
export const writePref = (k: string, v: string): void => { try { localStorage.setItem(k, v) } catch { /* yok say */ } }
const MAX = 5000

export const useStore = create<State>((set) => ({
  tabs: [], activeTabId: null, dock: 'right', workspaces: [], activeWorkspaceId: 'default', detected: [],
  events: new Map(), selectedEventId: null,
  editor: read('editor', 'vscode') as Editor, panelRatio: Number(read('panelRatio', '0.4')), split: Number(read('split', '0.42')),
  rules: {}, bookmarks: {}, downloads: [], overlay: null, find: { open: false, active: 0, total: 0 }, settings: { telemetry: 'unset', onboarded: true, language: 'en', installId: '' },
  set: (p) => set(p),
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
