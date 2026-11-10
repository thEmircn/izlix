import { createServer, type Server } from 'node:http'
import { readFile } from 'node:fs/promises'
import { extname, join, normalize, sep } from 'node:path'
import type { AddressInfo } from 'node:net'

const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.map': 'application/json', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml' }

/** Paketle gelen demo React uygulamasi + sahte API; yalnizca 127.0.0.1'de dinler. Onboarding'de ilk nedensellik zincirini gostermek icin. */
export class DemoServer {
  private server: Server | null = null
  port = 0
  constructor(private root: string) {}

  async start(): Promise<number> {
    if (this.server) return this.port
    this.server = createServer(async (req, res) => {
      const url = new URL(req.url ?? '/', 'http://x')
      if (url.pathname === '/api/items') {
        setTimeout(() => {
          if (url.searchParams.get('fail') === '1') { res.writeHead(500, { 'content-type': 'application/json' }).end('{"error":"boom"}'); return }
          res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(Array.from({ length: 5 }, (_, i) => ({ id: i, name: `Item ${i}` }))))
        }, 120)
        return
      }
      const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname))
      const file = join(this.root, rel)
      if (!file.startsWith(this.root + sep)) { res.writeHead(403).end(); return }
      try { res.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' }).end(await readFile(file)) } catch { res.writeHead(404).end() }
    })
    await new Promise<void>((r) => this.server!.listen(0, '127.0.0.1', r))
    this.port = (this.server.address() as AddressInfo).port
    return this.port
  }
  stop(): void { this.server?.close(); this.server = null }
}
