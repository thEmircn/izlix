import { app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { DEFAULT_DOMAINS, type RulesConfig } from '../shared/rules'

/** Workspace başına kurallar (JSON; SQLite geçişi workspace deposuyla birlikte yapılacak). */
export class RuleStore {
  private data: Record<string, RulesConfig> = {}
  private dir: string

  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.dir = dir
    this.data = loadDoc<Record<string, RulesConfig>>(dir, 'rules') ?? {}
  }

  get(wsId: string): RulesConfig { return this.data[wsId] ?? { rules: [], domains: [...DEFAULT_DOMAINS] } }
  all(): Record<string, RulesConfig> { return this.data }

  delete(wsId: string): void { delete this.data[wsId]; saveDoc(this.dir, 'rules', this.data) }

  set(wsId: string, cfg: RulesConfig): void {
    this.data[wsId] = cfg
    saveDoc(this.dir, 'rules', this.data)
  }
}
