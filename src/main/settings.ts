import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import type { Settings } from '../shared/events'

const DEFAULTS: Settings = { telemetry: 'unset', onboarded: false, language: 'en', installId: '', autoOpen: false }

export class SettingsStore {
  private data: Settings
  private file: string
  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'settings.json')
    let saved: Partial<Settings> = {}
    try { saved = JSON.parse(readFileSync(this.file, 'utf8')) } catch { /* ilk acilis */ }
    this.data = { ...DEFAULTS, ...saved }
    if (!this.data.installId) { this.data.installId = Math.random().toString(36).slice(2) + Date.now().toString(36); this.save() }
  }
  get(): Settings { return { ...this.data } }
  set(p: Partial<Pick<Settings, 'telemetry' | 'onboarded' | 'language' | 'autoOpen'>>): Settings { Object.assign(this.data, p); this.save(); return this.get() }
  private save(): void { try { writeFileSync(this.file, JSON.stringify(this.data, null, 1)) } catch { /* disk hatasi */ } }
}
