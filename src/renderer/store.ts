import { create } from 'zustand'
import type { BusEvent, DevToolsDock, Editor, TabInfo, WorkspaceInfo } from '../shared/events'

interface State {
  tabs: TabInfo[]; activeTabId: string | null; dock: DevToolsDock
  workspaces: WorkspaceInfo[]; activeWorkspaceId: string; detected: { port: number; cwd: string | null; framework?: string }[]
  events: Map<number, BusEvent>
  selectedEventId: number | null
  editor: Editor
  panelRatio: number
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
  editor: read('editor', 'vscode') as Editor, panelRatio: Number(read('panelRatio', '0.4')),
  set: (p) => set(p),
  ingest: (batch) => set((s) => {
    const next = new Map(s.events)
    for (const e of batch) next.set(e.id, e)
    if (next.size > MAX) for (const k of [...next.keys()].slice(0, next.size - MAX)) next.delete(k)
    return { events: next }
  }),
  reset: (list) => set({ events: new Map(list.map((e) => [e.id, e])), selectedEventId: null })
}))
