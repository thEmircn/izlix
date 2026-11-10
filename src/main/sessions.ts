import { app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { SessionInfo } from '../shared/events'

/** Workspace basina adlandirilmis sekme oturumlari (JSON). Yalnizca http(s)/about:blank adresleri saklanir. */
export class SessionStore {
  private data: Record<string, SessionInfo[]> = {}
  private dir: string
  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.dir = dir
    this.data = loadDoc<Record<string, SessionInfo[]>>(dir, 'sessions') ?? {}
  }
  private save(): void { saveDoc(this.dir, 'sessions', this.data) }
  list(wsId: string): SessionInfo[] { return (this.data[wsId] ?? []).slice().sort((a, b) => b.ts - a.ts) }
  all(): Record<string, SessionInfo[]> { return Object.fromEntries(Object.keys(this.data).map((k) => [k, this.list(k)])) }

  /** Ayni adla kaydetmek eskisinin uzerine yazar. Sekme yoksa null. */
  add(wsId: string, name: string, tabs: { url: string; title: string }[], active: number, split: [number, number] | null, now = Date.now()): SessionInfo | null {
    const clean = tabs.filter((t) => /^https?:\/\//.test(t.url)).slice(0, 40).map((t) => ({ url: t.url.slice(0, 2048), title: (t.title || '').slice(0, 200) }))
    if (!clean.length) return null
    const nm = name.trim().slice(0, 80) || `Session ${new Date(now).toLocaleTimeString()}`
    const s: SessionInfo = { id: `s-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`, name: nm, ts: now, tabs: clean, active: Math.min(Math.max(0, active), clean.length - 1), split: split && split[0] < clean.length && split[1] < clean.length ? split : null }
    const list = (this.data[wsId] ?? []).filter((x) => x.name !== nm)
    this.data[wsId] = [...list, s].slice(-30)
    this.save(); return s
  }
  get(wsId: string, id: string): SessionInfo | undefined { return (this.data[wsId] ?? []).find((x) => x.id === id) }
  remove(wsId: string, id: string): boolean {
    const before = (this.data[wsId] ?? []).length
    this.data[wsId] = (this.data[wsId] ?? []).filter((x) => x.id !== id)
    const ok = this.data[wsId].length < before; if (ok) this.save(); return ok
  }
  delete(wsId: string): void { delete this.data[wsId]; this.save() }
}
