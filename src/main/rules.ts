import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_DOMAINS, type RulesConfig } from '../shared/rules'

/** Workspace başına kurallar (JSON; SQLite geçişi workspace deposuyla birlikte yapılacak). */
export class RuleStore {
  private data: Record<string, RulesConfig> = {}
  private file: string

  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'rules.json')
    try { this.data = JSON.parse(readFileSync(this.file, 'utf8')) } catch { /* ilk açılış */ }
  }

  get(wsId: string): RulesConfig { return this.data[wsId] ?? { rules: [], domains: [...DEFAULT_DOMAINS] } }
  all(): Record<string, RulesConfig> { return this.data }

  set(wsId: string, cfg: RulesConfig): void {
    this.data[wsId] = cfg
    try { writeFileSync(this.file, JSON.stringify(this.data, null, 1)) } catch { /* disk hatası kuralları bellekte tutar */ }
  }
}
