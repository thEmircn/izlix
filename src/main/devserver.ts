import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { detectPackageManager, extractUrl, pickScripts, runCommand, stripAnsi, type PackageManager } from '../shared/devserver'

export interface ServerInfo {
  rootDir: string | null; pm: PackageManager; scripts: { name: string; cmd: string; likely: boolean }[]
  status: 'idle' | 'starting' | 'running' | 'exited'; script?: string; url?: string; exitCode?: number | null; lines: string[]
}
export type ServerEvent = { wsId: string; lines: string[]; status: ServerInfo['status']; url?: string; script?: string; exitCode?: number | null }

const MAX_LINES = 1500
interface Proc { child: ChildProcess; script: string; lines: string[]; url?: string; status: ServerInfo['status']; exitCode?: number | null; pending: string[]; timer: NodeJS.Timeout | null; tail: string }

/** Workspace basina bir dev sunucusu sureci: baslat/durdur, canli log, URL algilama. Yalnizca package.json'daki script'ler calistirilir. */
export class DevServers {
  private procs = new Map<string, Proc>()
  constructor(private emit: (e: ServerEvent) => void, private onUrl: (wsId: string, url: string) => void) {}

  static scan(rootDir: string | null): Pick<ServerInfo, 'pm' | 'scripts'> {
    if (!rootDir || !existsSync(rootDir)) return { pm: 'npm', scripts: [] }
    let pkg: { scripts?: Record<string, string> } | null = null
    try { pkg = JSON.parse(readFileSync(join(rootDir, 'package.json'), 'utf8')) } catch { /* package.json yok/bozuk */ }
    let files: string[] = []
    try { files = readdirSync(rootDir) } catch { /* okunamadi */ }
    return { pm: detectPackageManager(files), scripts: pickScripts(pkg) }
  }

  info(wsId: string, rootDir: string | null): ServerInfo {
    const p = this.procs.get(wsId)
    return { rootDir, ...DevServers.scan(rootDir), status: p?.status ?? 'idle', script: p?.script, url: p?.url, exitCode: p?.exitCode, lines: p?.lines.slice(-400) ?? [] }
  }

  start(wsId: string, rootDir: string, script: string): boolean {
    const cur = this.procs.get(wsId)
    if (cur && (cur.status === 'starting' || cur.status === 'running')) return false
    const { pm, scripts } = DevServers.scan(rootDir)
    if (!scripts.some((s) => s.name === script)) return false // yalnizca package.json'da tanimli script'ler
    const cmd = runCommand(pm, script)
    const shell = process.env.SHELL && existsSync(process.env.SHELL) ? process.env.SHELL : '/bin/zsh'
    // etkilesimli giris kabugu: .zprofile + .zshrc (nvm/asdf/brew PATH'leri) Finder'dan acilan uygulamada da gelsin
    const child = spawn(shell, ['-l', '-i', '-c', cmd], { cwd: rootDir, detached: true, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, FORCE_COLOR: '0', BROWSER: 'none', NO_COLOR: '1' } })
    const p: Proc = { child, script, lines: [`$ ${cmd}`], status: 'starting', pending: [`$ ${cmd}`], timer: null, tail: '' }
    this.procs.set(wsId, p)
    const onData = (buf: Buffer): void => {
      const text = p.tail + buf.toString('utf8')
      const parts = text.split(/\r?\n|\r/)
      p.tail = parts.pop() ?? ''
      for (const raw of parts) {
        const line = stripAnsi(raw)
        if (!line.trim() || /can't set tty pgrp|no job control in this shell|^\[?(oh-my-zsh|compinit)/i.test(line)) continue // etkilesimli kabuk gurultusu
        p.lines.push(line); p.pending.push(line)
        if (p.lines.length > MAX_LINES) p.lines.splice(0, p.lines.length - MAX_LINES)
        if (!p.url) { const u = extractUrl(line); if (u) { p.url = u; p.status = 'running'; this.onUrl(wsId, u) } }
      }
      this.flushSoon(wsId, p)
    }
    child.stdout?.on('data', onData); child.stderr?.on('data', onData)
    child.on('exit', (code) => { p.status = 'exited'; p.exitCode = code; const l = `[process exited${code != null ? ` with code ${code}` : ''}]`; p.lines.push(l); p.pending.push(l); this.flush(wsId, p) })
    child.on('error', (e) => { p.status = 'exited'; p.exitCode = -1; const l = `[failed to start: ${e.message}]`; p.lines.push(l); p.pending.push(l); this.flush(wsId, p) })
    this.emit({ wsId, lines: p.pending.splice(0), status: 'starting', script })
    return true
  }

  private flushSoon(wsId: string, p: Proc): void { if (!p.timer) p.timer = setTimeout(() => this.flush(wsId, p), 100) }
  private flush(wsId: string, p: Proc): void {
    if (p.timer) { clearTimeout(p.timer); p.timer = null }
    this.emit({ wsId, lines: p.pending.splice(0), status: p.status, url: p.url, script: p.script, exitCode: p.exitCode })
  }

  stop(wsId: string): void {
    const p = this.procs.get(wsId)
    if (!p || p.status === 'exited' || !p.child.pid) return
    const pid = p.child.pid
    try { process.kill(-pid, 'SIGTERM') } catch { /* zaten bitmis */ }
    setTimeout(() => { try { process.kill(-pid, 'SIGKILL') } catch { /* bitmis */ } }, 3000).unref()
  }
  stopAll(): void { for (const id of this.procs.keys()) this.stop(id) }
}
