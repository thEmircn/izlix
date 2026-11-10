import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Settings } from '../shared/events'

const DEFAULTS: Settings = { telemetry: 'unset', onboarded: false, language: 'tr', installId: '', autoOpen: false }

export class SettingsStore {
  private data: Settings
  private file: string
  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'settings.json')
    let saved: Partial<Settings> = {}
    try { saved = JSON.parse(readFileSync(this.file, 'utf8')) } catch { /* ilk acilis */ }
    this.data = { ...DEFAULTS, ...saved }
    // surum 2: varsayilan dil Turkce; daha once secim kaydi olmayan (surumsuz) ayarlar bir kez Turkceye tasinir
    if (!(saved as { langV?: number }).langV) { this.data.language = 'tr'; (this.data as Settings & { langV?: number }).langV = 2; this.save() }
    if (!this.data.installId) { this.data.installId = Math.random().toString(36).slice(2) + Date.now().toString(36); this.save() }
  }
  get(): Settings { return { ...this.data } }
  set(p: Partial<Pick<Settings, 'telemetry' | 'onboarded' | 'language' | 'autoOpen'>>): Settings { Object.assign(this.data, p); this.save(); return this.get() }
  private save(): void { try { writeFileSync(this.file, JSON.stringify(this.data, null, 1)) } catch { /* disk hatasi */ } }
}
