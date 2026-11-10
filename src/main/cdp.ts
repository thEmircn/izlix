import type { WebContents } from 'electron'
import type { EventBus } from './bus'
import { ADAPTERS, BINDING } from './adapters'
import { SourceResolver } from './sources'
import { Correlator } from './correlate'
import { parseHmr } from './hmr'

export interface Tab { resolver: SourceResolver; correlator: Correlator; detach(): void }

/** CDP monotonik saatini (saniye) epoch ms'e cevirir; offset her requestWillBeSent'te (wallTime) guncellenir. */
export class ClockSync {
  private offsetMs: number | null = null
  observe(monotonicSec: number, wallSec: number): void { this.offsetMs = wallSec * 1000 - monotonicSec * 1000 }
  toEpoch(monotonicSec: number | undefined, fallback: number): number {
    return monotonicSec != null && this.offsetMs != null ? monotonicSec * 1000 + this.offsetMs : fallback
  }
}

// CDP toplayici: Network, Runtime, Page olaylarini ve React koprusunu veriyoluna baglar.
// NOT: webContents'e ilk sayfa yuklenmeden CDP komutlari yanit vermez; cagiran once about:blank yuklemeli.
// NOT: Debugger domain'i burada ACILMAZ: yukleme suresini ~%60 sisirir (bkz. docs/faz0-raporu.md). Bkz. sources.ts.
export async function attachCdp(wc: WebContents, tabId: string, bus: EventBus, rootProvider?: () => string | null): Promise<Tab> {
  const dbg = wc.debugger
  dbg.attach('1.3')
  const resolver = new SourceResolver(wc)
  resolver.rootProvider = rootProvider ?? null
  const correlator = new Correlator(bus, resolver, tabId)
  const clock = new ClockSync()
  const reqEvents = new Map<string, number>(), resEvents = new Map<string, number>()

  const onMessage = (_e: unknown, method: string, p: any): void => {
    const now = Date.now()
    switch (method) {
      case 'Network.requestWillBeSent':
        if (p.wallTime) clock.observe(p.timestamp, p.wallTime)
        {
          const ev = bus.emit({ tabId, kind: 'request', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: {
            requestId: p.requestId, url: p.request.url, method: p.request.method, type: p.type, initiator: p.initiator,
            headers: p.request.headers, postData: typeof p.request.postData === 'string' ? p.request.postData.slice(0, 20_000) : undefined
          } })
          reqEvents.set(p.requestId, ev.id)
          if (reqEvents.size > 2000) reqEvents.delete(reqEvents.keys().next().value!)
        }
        break
      case 'Network.responseReceived':
        {
          const ev = bus.emit({ tabId, kind: 'response', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: {
            requestId: p.requestId, url: p.response.url, status: p.response.status, statusText: p.response.statusText, mimeType: p.response.mimeType, type: p.type,
            headers: p.response.headers, protocol: p.response.protocol, remote: p.response.remoteIPAddress, fromCache: !!(p.response.fromDiskCache || p.response.fromServiceWorker),
            timing: p.response.timing
          } })
          resEvents.set(p.requestId, ev.id)
          if (resEvents.size > 2000) resEvents.delete(resEvents.keys().next().value!)
        }
        break
      case 'Network.webSocketCreated': {
        const ev = bus.emit({ tabId, kind: 'request', ts: now, source: `cdp:${method}`, payload: { requestId: p.requestId, url: p.url, method: 'WS', type: 'WebSocket', initiator: p.initiator } })
        reqEvents.set(p.requestId, ev.id)
        break
      }
      case 'Network.webSocketHandshakeResponseReceived': {
        const ev = bus.emit({ tabId, kind: 'response', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: { requestId: p.requestId, url: '', status: p.response.status, statusText: p.response.statusText, type: 'WebSocket', headers: p.response.headers, mimeType: 'websocket' } })
        resEvents.set(p.requestId, ev.id)
        break
      }
      case 'Network.webSocketFrameSent':
      case 'Network.webSocketFrameReceived': {
        const text = String(p.response?.payloadData ?? '')
        bus.emit({ tabId, kind: 'ws', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: {
          requestId: p.requestId, dir: method.endsWith('Sent') ? 'sent' : 'recv', opcode: p.response?.opcode, size: p.response?.opcode === 2 ? Math.floor(text.length * 0.75) : Buffer.byteLength(text), data: text.slice(0, 8000), truncated: text.length > 8000
        } })
        break
      }
      case 'Network.webSocketFrameError':
        bus.emit({ tabId, kind: 'ws', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: { requestId: p.requestId, dir: 'error', data: String(p.errorMessage ?? '') } })
        break
      case 'Network.webSocketClosed':
        bus.emit({ tabId, kind: 'ws', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: { requestId: p.requestId, dir: 'closed' } })
        break
      case 'Network.loadingFinished': {
        // indirme bitti: toplam bayt ve bitis zamani yanit olayina eklenir (waterfall + boyut)
        const id = resEvents.get(p.requestId)
        if (id != null) bus.patch(id, { size: p.encodedDataLength, finishedTs: clock.toEpoch(p.timestamp, now) })
        break
      }
      case 'Network.loadingFailed':
        if (p.canceled || /ERR_ABORTED|ERR_CACHE_MISS/.test(p.errorText ?? '')) break // gurultu: iptal/onbellek
        bus.emit({ tabId, kind: 'error', ts: clock.toEpoch(p.timestamp, now), source: `cdp:${method}`, payload: { requestId: p.requestId, errorText: p.errorText } })
        break
      case 'Runtime.consoleAPICalled': // timestamp: epoch ms
        {
          const text = (p.args ?? []).map((a: any) => a.value ?? a.description ?? a.type).join(' ')
          bus.emit({ tabId, kind: 'console', ts: p.timestamp ?? now, source: `cdp:${method}`, payload: { level: p.type, text, stackTrace: p.stackTrace } })
          const hmr = parseHmr(text)
          if (hmr) bus.emit({ tabId, kind: 'hmr', ts: p.timestamp ?? now, source: `hmr:${hmr.tool}`, payload: hmr })
        }
        break
      case 'Runtime.exceptionThrown': // timestamp: epoch ms
        bus.emit({ tabId, kind: 'error', ts: p.timestamp ?? now, source: `cdp:${method}`, payload: {
          text: p.exceptionDetails?.exception?.description ?? p.exceptionDetails?.text,
          url: p.exceptionDetails?.url, line: p.exceptionDetails?.lineNumber, stackTrace: p.exceptionDetails?.stackTrace
        } })
        break
      case 'Runtime.bindingCalled':
        if (p.name === BINDING) handleBridge(p.payload, tabId, bus, correlator)
        break
      case 'Page.frameNavigated':
        if (!p.frame.parentId) bus.emit({ tabId, kind: 'navigation', source: `cdp:${method}`, payload: { url: p.frame.url } })
        break
    }
  }
  dbg.on('message', onMessage)

  await dbg.sendCommand('Network.enable')
  await dbg.sendCommand('Runtime.enable')
  await dbg.sendCommand('Page.enable')
  await dbg.sendCommand('Runtime.addBinding', { name: BINDING })
  for (const a of ADAPTERS) await dbg.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: a.script })
  return { resolver, correlator, detach: () => { dbg.removeListener('message', onMessage); try { dbg.detach() } catch { /* zaten kopmus */ } } }
}

/** Kopru mesaji -> olay. Sayfa saati (epoch ms) dogrudan ts olur: tum eksenin referansi. */
export function handleBridge(raw: string, tabId: string, bus: EventBus, correlator: Pick<Correlator, 'onFetchStart'>): void {
  let m: any
  try { m = JSON.parse(raw) } catch { return }
  const { type, wall, ...rest } = m
  const ts = typeof wall === 'number' ? wall : undefined
  switch (type) {
    case 'fetch-start': correlator.onFetchStart(rest.url, rest.inputId); break
    case 'commit': bus.emit({ tabId, kind: 'render', ts, source: 'bridge:commit', payload: rest }); break
    case 'input': bus.emit({ tabId, kind: 'input', ts, source: 'bridge:input', payload: rest }); break
    case 'bridge-error': bus.emit({ tabId, kind: 'error', ts, source: 'bridge:error', payload: rest }); break
    case 'vital': bus.emit({ tabId, kind: 'vital', ts, source: 'bridge:vital', payload: rest }); break
    case 'inject': bus.emit({ tabId, kind: 'navigation', ts, source: 'bridge:inject', payload: rest }); break
  }
}
