import { loadDoc, saveDoc } from './docdb'
import { buildRequest, needsKey, parseAnswer, type AiConfig, type Provider } from '../shared/ai'
import { maskString } from '../shared/mask'
import type { Cipher } from './passwords'

/** "AI ile acikla": anahtar Keychain'e bagli safeStorage ile sifreli saklanir ve ARAYUZE ASLA donmez; istek ana surecten yapilir. */
export class AiService {
  private keys: Partial<Record<Provider, string>>
  constructor(private dir: string, private cipher: Cipher, private cfg: () => AiConfig, private fetchFn: typeof fetch = fetch) { this.keys = loadDoc<Partial<Record<Provider, string>>>(dir, 'aikeys') ?? {} }
  hasKey(p: Provider): boolean { return !!this.keys[p] }
  setKey(p: Provider, key: string): boolean {
    if (!this.cipher.available()) return false
    if (!key.trim()) delete this.keys[p]; else this.keys[p] = this.cipher.encrypt(key.trim())
    saveDoc(this.dir, 'aikeys', this.keys); return true
  }
  /** Gonderilecek metin (maskelenir) ve hedef; anahtar gerekliyse ve yoksa hata */
  async ask(prompt: string, lang: string): Promise<{ ok: true; text: string } | { ok: false; error: 'nokey' | 'http' | 'network' | 'empty'; detail?: string }> {
    const cfg = this.cfg(), enc = this.keys[cfg.provider]
    if (needsKey(cfg.provider) && !enc) return { ok: false, error: 'nokey' }
    const req = buildRequest(cfg, enc ? this.cipher.decrypt(enc) : null, maskString(prompt).slice(0, 8000), lang)
    try {
      const r = await this.fetchFn(req.url, { method: 'POST', headers: req.headers, body: req.body, signal: AbortSignal.timeout(60_000) })
      if (!r.ok) return { ok: false, error: 'http', detail: `${r.status} ${(await r.text().catch(() => '')).slice(0, 200)}` }
      const text = parseAnswer(cfg.provider, await r.json().catch(() => null))
      return text ? { ok: true, text } : { ok: false, error: 'empty' }
    } catch (e) { return { ok: false, error: 'network', detail: String((e as Error).message ?? e).slice(0, 200) } }
  }
}
