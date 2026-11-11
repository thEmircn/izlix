// "AI ile acikla": gonderilecek metni olustur (maskeli, sinirli), saglayici istegi ve yaniti (saf). Hicbir sey kullanici onaylamadan gonderilmez.
import type { BusEvent } from './events'
import { maskString } from './mask'
import { buildNetworkRows } from './network'

export type Provider = 'ollama' | 'anthropic' | 'openai'
export interface AiConfig { provider: Provider; model: string; /** ollama icin adres (varsayilan http://127.0.0.1:11434) */ endpoint?: string }
export const DEFAULT_MODELS: Record<Provider, string> = { ollama: 'llama3.1', anthropic: 'claude-sonnet-5-5', openai: 'gpt-4o-mini' }
export const MAX_PROMPT = 7000

const SYSTEM = (lang: string): string => `You are a senior React/web debugging assistant inside a izlix. You get a compact, redacted log of what just happened on a page (errors, failed requests, console errors). Explain the most likely root cause, how the events relate (request -> state -> render -> error), and give concrete fixes with short code where useful. Be concise. Answer in ${lang === 'tr' ? 'Turkish' : 'English'}.`
export const systemPrompt = SYSTEM

const clip = (s: string, n: number): string => (s.length > n ? s.slice(0, n) + '…' : s)
const stackTop = (st: any, n = 4): string => (st?.callFrames ?? []).slice(0, n).map((f: any) => `  at ${f.functionName || '<anonymous>'} (${String(f.url ?? '').split('/').slice(-2).join('/')}:${(f.lineNumber ?? 0) + 1})`).join('\n')

/** Etkinlikten (son gezinmeden beri) kisa, maskeli bir hata ozeti. `focusId` verilirse o olay ve nedenleri one cikar. */
export function buildAiContext(events: BusEvent[], pageUrl: string, focusId?: number): string {
  let from = 0; for (const e of events) if (e.kind === 'navigation' && e.source === 'cdp:Page.frameNavigated') from = e.ts
  const ev = events.filter((e) => e.ts >= from)
  const parts: string[] = []
  let path = pageUrl; try { const u = new URL(pageUrl); path = u.origin === 'null' ? pageUrl : `${u.pathname}${u.search ? '?…' : ''}` } catch { /* gecersiz */ }
  parts.push(`Page: ${path}`)
  const errs = ev.filter((e) => e.kind === 'error' && (e.payload.text || e.payload.message)).slice(-5)
  for (const e of errs) parts.push(`ERROR: ${clip(String(e.payload.text ?? e.payload.message), 500)}\n${stackTop(e.payload.stackTrace)}`.trimEnd())
  const cons = ev.filter((e) => e.kind === 'console' && (e.payload.level === 'error' || e.payload.level === 'warning' || e.payload.level === 'warn')).slice(-6)
  for (const e of cons) parts.push(`CONSOLE ${String(e.payload.level).toUpperCase()}: ${clip(String(e.payload.text ?? ''), 300)}`)
  const rows = buildNetworkRows(ev.filter((e) => e.kind === 'request' || e.kind === 'response' || e.kind === 'error'))
  const bad = rows.filter((r) => r.failed || (r.status ?? 0) >= 400).slice(-6)
  for (const r of bad) { let p = r.url; try { const u = new URL(r.url); p = u.pathname + (u.search ? '?…' : '') } catch { /* gecersiz */ } parts.push(`REQUEST FAILED: ${r.method} ${clip(p, 140)} -> ${r.failed ?? r.status}`) }
  if (focusId !== undefined) {
    const f = events.find((e) => e.id === focusId)
    if (f) { const chain: string[] = [`${f.kind}${f.payload.name ? ` ${f.payload.name}` : ''}${f.payload.text ? `: ${clip(String(f.payload.text), 160)}` : ''}`]; let cur = f; for (let i = 0; i < 5 && cur.links?.length; i++) { const src = events.find((e) => e.id === cur.links[0].from); if (!src) break; chain.push(`<- ${src.kind}${src.payload.name ? ` ${src.payload.name}` : ''}${src.payload.url ? ` ${String(src.payload.url).split('?')[0].split('/').slice(-2).join('/')}` : ''} (${cur.links[0].certainty})`); cur = src } parts.push(`FOCUS CHAIN: ${chain.join(' ')}`) }
  }
  const recentRenders = ev.filter((e) => e.kind === 'render').slice(-4).map((e) => String(e.payload.name ?? '')).filter(Boolean)
  if (recentRenders.length) parts.push(`RECENT RENDERS: ${recentRenders.join(', ')}`)
  return clip(maskString(parts.join('\n\n')), MAX_PROMPT)
}

export interface AiRequest { url: string; headers: Record<string, string>; body: string }
/** Saglayiciya gidecek istek (anahtar yalniz basliga girer; gonderilen METIN onizlemede gosterilenle ayni) */
export function buildRequest(cfg: AiConfig, key: string | null, prompt: string, lang: string): AiRequest {
  const sys = systemPrompt(lang)
  if (cfg.provider === 'ollama') return { url: `${(cfg.endpoint || 'http://127.0.0.1:11434').replace(/\/+$/, '')}/api/chat`, headers: { 'content-type': 'application/json' }, body: JSON.stringify({ model: cfg.model, stream: false, messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }) }
  if (cfg.provider === 'anthropic') return { url: 'https://api.anthropic.com/v1/messages', headers: { 'content-type': 'application/json', 'x-api-key': key ?? '', 'anthropic-version': '2023-06-01' }, body: JSON.stringify({ model: cfg.model, max_tokens: 1200, system: sys, messages: [{ role: 'user', content: prompt }] }) }
  return { url: 'https://api.openai.com/v1/chat/completions', headers: { 'content-type': 'application/json', authorization: `Bearer ${key ?? ''}` }, body: JSON.stringify({ model: cfg.model, messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }] }) }
}
export function parseAnswer(provider: Provider, j: any): string | null {
  const t = provider === 'ollama' ? j?.message?.content : provider === 'anthropic' ? (Array.isArray(j?.content) ? j.content.filter((c: any) => c.type === 'text').map((c: any) => c.text).join('') : null) : j?.choices?.[0]?.message?.content
  return typeof t === 'string' && t.trim() ? t : null
}
export const needsKey = (p: Provider): boolean => p !== 'ollama'
