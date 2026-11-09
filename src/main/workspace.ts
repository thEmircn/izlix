import { app } from 'electron'
import { join, basename } from 'node:path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { execFile } from 'node:child_process'
import type { WorkspaceInfo } from '../shared/events'

// Workspace = tek kavram (plan: Spaces + Project Workspaces + Localhost Detector).
// Veri modeli (K-13, spike bulgusu): { kok klasor, dev sunucu portlari, oturum bolumu }.
// Depolama: simdilik JSON; SQLite (better-sqlite3) native derleme gerektirdigi icin ayri adimda.
interface Stored { id: string; name: string; rootDir: string | null }

export const partitionFor = (id: string): string => `persist:ws-${id}`

export class WorkspaceStore {
  private items: Stored[] = []
  private file: string
  servers = new Map<string, WorkspaceInfo['servers']>()

  constructor(dir = app.getPath('userData')) {
    mkdirSync(dir, { recursive: true })
    this.file = join(dir, 'workspaces.json')
    try { this.items = JSON.parse(readFileSync(this.file, 'utf8')) } catch { /* ilk acilis */ }
    if (!this.items.length) { this.items = [{ id: 'default', name: 'Default', rootDir: null }]; this.save() }
  }

  private save(): void { writeFileSync(this.file, JSON.stringify(this.items, null, 1)) }

  list(): WorkspaceInfo[] {
    return this.items.map((w) => ({ ...w, servers: this.servers.get(w.id) ?? [] }))
  }
  get(id: string): Stored | undefined { return this.items.find((w) => w.id === id) }

  create(name: string, rootDir: string | null): Stored {
    const existing = rootDir ? this.items.find((w) => w.rootDir === rootDir) : undefined
    if (existing) return existing
    const w = { id: Math.random().toString(36).slice(2, 10), name: name || (rootDir ? basename(rootDir) : 'Workspace'), rootDir }
    this.items.push(w); this.save()
    return w
  }

  /** Bir dev sunucusunun cwd'sine gore Workspace'i bul: en uzun kok eslesmesi kazanir */
  workspaceForCwd(cwd: string): Stored | undefined {
    return this.items
      .filter((w) => w.rootDir && (cwd === w.rootDir || cwd.startsWith(w.rootDir + '/')))
      .sort((a, b) => b.rootDir!.length - a.rootDir!.length)[0]
  }
}

// ---- Localhost Detector ----
export interface DetectedServer { port: number; pid: number; cwd: string | null; framework?: string }

/** lsof hata/zaman asimi: null (bos cikti ile karistirilmaz; cagiran son bilinen durumu korur) */
const run = (cmd: string, args: string[]): Promise<string | null> =>
  new Promise((res) => execFile(cmd, args, { timeout: 4000 }, (err, out) => res(err && !out ? null : out ?? '')))

/** Dinleyen node/bun/deno surecleri: tek lsof ile portlar, ikinci lsof ile cwd'ler. */
export async function detectServers(): Promise<DetectedServer[] | null> {
  const out = await run('lsof', ['-iTCP', '-sTCP:LISTEN', '-n', '-P', '-Fpcn'])
  if (out === null) return null
  const found = new Map<number, { pid: number; port: number }>()
  let pid = 0, cmd = ''
  for (const line of out.split('\n')) {
    if (line[0] === 'p') pid = Number(line.slice(1))
    else if (line[0] === 'c') cmd = line.slice(1)
    else if (line[0] === 'n' && /^(node|bun|deno|vite|next|esbuild)/i.test(cmd)) {
      const m = line.match(/:(\d+)$/)
      const port = m ? Number(m[1]) : 0
      if (port >= 1024 && !found.has(port)) found.set(port, { pid, port })
    }
  }
  if (!found.size) return []
  const pids = [...new Set([...found.values()].map((f) => f.pid))]
  const cwdOut = (await run('lsof', ['-a', '-p', pids.join(','), '-d', 'cwd', '-Fpn'])) ?? ''
  const cwds = new Map<number, string>()
  let cur = 0
  for (const line of cwdOut.split('\n')) {
    if (line[0] === 'p') cur = Number(line.slice(1))
    else if (line[0] === 'n') cwds.set(cur, line.slice(1))
  }
  return [...found.values()].map((f) => {
    const cwd = cwds.get(f.pid) ?? null
    return { ...f, cwd, framework: cwd ? guessFramework(cwd) : undefined }
  }).sort((a, b) => a.port - b.port)
}

export function guessFramework(cwd: string): string | undefined {
  try {
    const p = join(cwd, 'package.json')
    if (!existsSync(p)) return undefined
    const j = JSON.parse(readFileSync(p, 'utf8'))
    const d = { ...j.dependencies, ...j.devDependencies }
    if (d.next) return 'Next.js'
    if (d.vite) return 'Vite'
    if (d['react-scripts']) return 'CRA'
    return d.react ? 'React' : undefined
  } catch { return undefined }
}
