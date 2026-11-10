import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface MockResponse { status: number; body: string; contentType: string }

/**
 * Yalnızca 127.0.0.1'de dinleyen küçük mock sunucusu. Chromium, çapraz-origin ve gövdeli isteklere
 * Fetch.fulfillRequest ile yanıt verilince çöküyor (Electron 45 ile doğrulandı); bu istekler buraya yönlendirilir.
 */
export class MockServer {
  private server: Server | null = null
  private items = new Map<string, MockResponse>()
  private port = 0

  async url(m: MockResponse): Promise<string> {
    if (!this.server) await this.start()
    const token = Math.random().toString(36).slice(2)
    this.items.set(token, m)
    if (this.items.size > 500) this.items.delete(this.items.keys().next().value!)
    return `http://127.0.0.1:${this.port}/m/${token}`
  }

  private start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = createServer((req, res) => {
        const origin = String(req.headers.origin ?? '*')
        const cors = { 'Access-Control-Allow-Origin': origin, 'Access-Control-Allow-Headers': '*', 'Access-Control-Allow-Methods': '*', 'X-Izlix-Mock': '1' }
        if (req.method === 'OPTIONS') { res.writeHead(204, cors).end(); return }
        const m = this.items.get((req.url ?? '').replace('/m/', ''))
        req.resume()
        if (!m) { res.writeHead(404, cors).end(); return }
        res.writeHead(m.status, { ...cors, 'Content-Type': m.contentType }).end(m.body)
      })
      this.server.listen(0, '127.0.0.1', () => { this.port = (this.server!.address() as AddressInfo).port; resolve() })
    })
  }

  stop(): void { this.server?.close(); this.server = null }
}
