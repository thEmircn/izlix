import { app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Settings } from '../shared/events'

const DEFAULTS: Settings = { telemetry: 'unset', onboarded: false, language: 'tr', searchEngine: 'duckduckgo', installId: '', autoOpen: false }

export class SettingsStore {
  private data: Settings
  private dir: string
  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.dir = dir
    const saved: Partial<Settings> = loadDoc<Partial<Settings>>(dir, 'settings') ?? {}
    this.data = { ...DEFAULTS, ...saved }
    // surum 2: varsayilan dil Turkce; daha once secim kaydi olmayan (surumsuz) ayarlar bir kez Turkceye tasinir
    if (!(saved as { langV?: number }).langV) { this.data.language = 'tr'; (this.data as Settings & { langV?: number }).langV = 2; this.save() }
    if (!this.data.installId) { this.data.installId = Math.random().toString(36).slice(2) + Date.now().toString(36); this.save() }
  }
  get(): Settings { return { ...this.data } }
  set(p: Partial<Pick<Settings, 'telemetry' | 'onboarded' | 'language' | 'autoOpen' | 'searchEngine'>>): Settings { Object.assign(this.data, p); this.save(); return this.get() }
  private save(): void { saveDoc(this.dir, 'settings', this.data) }
}
