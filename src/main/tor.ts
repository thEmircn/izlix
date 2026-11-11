import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, mkdirSync } from 'node:fs'
import { connect } from 'node:net'
import { join } from 'node:path'

/** Sistemde calisan Tor'un bilinen SOCKS portlari (tor daemon, Tor Browser) ve kendi baslattigimiz port. */
export const SYSTEM_PORTS = [9050, 9150]
export const OWN_PORT = 9155
export const TOR_BINARIES = ['/opt/homebrew/bin/tor', '/usr/local/bin/tor', '/opt/local/bin/tor']
export type TorResult = { ok: true; port: number; own: boolean } | { ok: false; reason: 'missing' | 'timeout' | 'failed' }

export const isBootstrapped = (line: string): boolean => /Bootstrapped 100%/.test(line)

const tcpProbe = (port: number): Promise<boolean> => new Promise((res) => {
  const s = connect({ host: '127.0.0.1', port }); const done = (v: boolean): void => { s.destroy(); res(v) }
  s.setTimeout(600, () => done(false)); s.once('connect', () => done(true)); s.once('error', () => done(false))
})

/** Tor erisimi: calisan bir SOCKS portu varsa onu kullanir, yoksa yerel `tor` ikilisini kendi veri klasoruyle baslatir. */
export class TorService {
  private child: ChildProcess | null = null
  private pending: Promise<TorResult> | null = null
  private ready: TorResult | null = null
  constructor(private dataDir: string, private probe: (port: number) => Promise<boolean> = tcpProbe,
    private binaries: string[] = TOR_BINARIES, private timeoutMs = 90_000, private exists: (p: string) => boolean = existsSync) {}

  ensure(): Promise<TorResult> {
    if (this.ready?.ok) return Promise.resolve(this.ready)
    this.pending ??= this.start().then((r) => { if (r.ok) this.ready = r; this.pending = null; return r })
    return this.pending
  }

  private async start(): Promise<TorResult> {
    for (const p of [...SYSTEM_PORTS, OWN_PORT]) if (await this.probe(p)) return { ok: true, port: p, own: p === OWN_PORT && !!this.child }
    const bin = this.binaries.find((b) => this.exists(b))
    if (!bin) return { ok: false, reason: 'missing' }
    mkdirSync(this.dataDir, { recursive: true })
    return new Promise<TorResult>((resolve) => {
      let settled = false
      const fin = (r: TorResult): void => { if (!settled) { settled = true; clearTimeout(timer); resolve(r) } }
      const child = spawn(bin, ['--SocksPort', `127.0.0.1:${OWN_PORT}`, '--DataDirectory', join(this.dataDir, 'data'), '--ClientOnly', '1', '--Log', 'notice stdout'], { stdio: ['ignore', 'pipe', 'ignore'] })
      this.child = child
      const timer = setTimeout(() => { this.stop(); fin({ ok: false, reason: 'timeout' }) }, this.timeoutMs)
      let buf = ''
      child.stdout?.on('data', (d: Buffer) => { buf += d.toString(); const lines = buf.split('\n'); buf = lines.pop() ?? ''; if (lines.some(isBootstrapped)) fin({ ok: true, port: OWN_PORT, own: true }) })
      child.once('error', () => fin({ ok: false, reason: 'failed' }))
      child.once('exit', () => { this.child = null; this.ready = null; fin({ ok: false, reason: 'failed' }) })
    })
  }

  stop(): void { try { this.child?.kill() } catch { /* zaten kapali */ } this.child = null; this.ready = null }
}
