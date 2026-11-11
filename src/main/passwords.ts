import { app, safeStorage, clipboard, type WebContents } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { createHash } from 'node:crypto'
import { isWeak, parseRange } from '../shared/pwgen'
import { PW_BINDING, PW_SCRIPT, fillScript, type LoginMeta } from '../shared/passwords'

export interface Cipher { available(): boolean; encrypt(s: string): string; decrypt(s: string): string }
/** Uretim: macOS Keychain'deki anahtarla (Electron safeStorage) sifreleme. */
/** Linux'ta anahtarlik (libsecret/kwallet) yoksa Electron "basic_text" kullanir: anahtar duz metin kadar korumasizdir. Bu durumda sifre SAKLANMAZ. */
export const weakKeystore = (): boolean => process.platform === 'linux' && typeof safeStorage.getSelectedStorageBackend === 'function' && safeStorage.getSelectedStorageBackend() === 'basic_text'
export const keychainCipher: Cipher = {
  available: () => safeStorage.isEncryptionAvailable() && !weakKeystore(),
  encrypt: (s) => safeStorage.encryptString(s).toString('base64'),
  decrypt: (s) => safeStorage.decryptString(Buffer.from(s, 'base64'))
}
/** Yalnizca testler (DB_SCRIPT): Keychain izin penceresi cikmasin */
export const plainCipher: Cipher = { available: () => true, encrypt: (s) => Buffer.from(s).toString('base64'), decrypt: (s) => Buffer.from(s, 'base64').toString() }

interface Doc { logins: Record<string, { u: string; p: string; ts: number }[]>; never: string[] }
export interface AuditRow { origin: string; username: string; weak: boolean; /** ayni parolayi kullanan DIGER kayit sayisi */ reused: number; /** sizinti sayisi; null: denetlenmedi/ulasilamadi */ pwned: number | null }
export type SaveAnswer = 'save' | 'never' | 'later'
export type PwHooks = {
  ask: (wc: WebContents, origin: string, username: string, update: boolean) => Promise<SaveAnswer>
  pick: (wc: WebContents, usernames: string[]) => Promise<number>
  isPrivate: (wc: WebContents) => boolean
  changed: () => void
}

const originOf = (u: string): string | null => { try { const x = new URL(u); return x.protocol === 'http:' || x.protocol === 'https:' ? x.origin : null } catch { return null } }

/** Sifre yoneticisi: giris formu yakalama (CDP binding), Keychain ile sifreli yerel depo, dogrulanmis kaynakta doldurma. Sifreler arayuze ASLA gonderilmez. */
export class PasswordService {
  private doc: Doc
  private busy = false
  private lastSave = new WeakMap<WebContents, number>()
  constructor(private dir: string = app.getPath('userData'), private cipher: Cipher = keychainCipher, private hooks: PwHooks) {
    const d = loadDoc<Doc>(dir, 'passwords'); this.doc = { logins: d?.logins ?? {}, never: d?.never ?? [] }
  }
  private save(): void { saveDoc(this.dir, 'passwords', this.doc); this.hooks.changed() }

  count(url: string): number { const o = originOf(url); return o ? (this.doc.logins[o]?.length ?? 0) : 0 }
  list(): LoginMeta[] { return Object.entries(this.doc.logins).flatMap(([origin, l]) => l.map((x) => ({ origin, username: x.u, ts: x.ts }))).sort((a, b) => b.ts - a.ts) }
  never(): string[] { return [...this.doc.never] }
  removeNever(origin: string): void { this.doc.never = this.doc.never.filter((x) => x !== origin); this.save() }
  remove(origin: string, username: string): void {
    const l = (this.doc.logins[origin] ?? []).filter((x) => x.u !== username)
    if (l.length) this.doc.logins[origin] = l; else delete this.doc.logins[origin]
    this.save()
  }
  /** Parolayi panoya koyar; 30 sn sonra (pano degismediyse) temizler */
  copy(origin: string, username: string): boolean {
    const e = this.doc.logins[origin]?.find((x) => x.u === username); if (!e) return false
    const p = this.cipher.decrypt(e.p); void clipboard.writeText(p)
    setTimeout(() => { void Promise.resolve(clipboard.readText()).then((t) => { if (t === p) void clipboard.clear() }) }, 30_000).unref()
    return true
  }
  /** test/duzenleme: bu kaynak icin kayitli (kullanici, parola) */
  getFor(origin: string): { u: string; p: string }[] { return (this.doc.logins[origin] ?? []).map((x) => ({ u: x.u, p: this.cipher.decrypt(x.p) })) }

  /** Guvenlik denetimi: zayif / tekrar kullanilan (yerel) ve sizmis (HIBP k-anonymity: yalniz SHA-1'in ilk 5 karakteri gider). Parola donmez. */
  async audit(fetchRange: ((prefix: string) => Promise<string | null>) | null): Promise<AuditRow[]> {
    const rows = Object.entries(this.doc.logins).flatMap(([origin, l]) => l.map((x) => ({ origin, username: x.u, pw: this.cipher.decrypt(x.p) })))
    const counts = new Map<string, number>(); for (const r of rows) counts.set(r.pw, (counts.get(r.pw) ?? 0) + 1)
    const sha = (s: string): string => createHash('sha1').update(s).digest('hex').toUpperCase()
    const ranges = new Map<string, string | null>()
    if (fetchRange) {
      const prefixes = [...new Set(rows.map((r) => sha(r.pw).slice(0, 5)))]
      for (let i = 0; i < prefixes.length; i += 4) await Promise.all(prefixes.slice(i, i + 4).map(async (p) => { ranges.set(p, await fetchRange(p).catch(() => null)) }))
    }
    return rows.map((r) => {
      const h = sha(r.pw), txt = ranges.get(h.slice(0, 5))
      return { origin: r.origin, username: r.username, weak: isWeak(r.pw), reused: (counts.get(r.pw) ?? 1) - 1, pwned: fetchRange ? (txt == null ? null : parseRange(txt, h.slice(5))) : null }
    })
  }

  /** Sekmeye bagla: binding + belge-basi betik; sayfadan gelen cagrilari dinle */
  async attach(wc: WebContents): Promise<void> {
    if (wc.isDestroyed()) return
    await wc.debugger.sendCommand('Runtime.addBinding', { name: PW_BINDING }).catch(() => {})
    await wc.debugger.sendCommand('Page.enable').catch(() => {})
    await wc.debugger.sendCommand('Page.addScriptToEvaluateOnNewDocument', { source: PW_SCRIPT }).catch(() => {})
    wc.debugger.on('message', (_e, method, p: { name?: string; payload?: string }) => {
      if (method === 'Runtime.bindingCalled' && p.name === PW_BINDING && typeof p.payload === 'string' && p.payload.length < 5000) void this.onCall(wc, p.payload)
    })
  }

  private async onCall(wc: WebContents, payload: string): Promise<void> {
    let m: { t?: string; u?: string; p?: string }
    try { m = JSON.parse(payload) } catch { return }
    if (wc.isDestroyed() || this.hooks.isPrivate(wc)) return
    const origin = originOf(wc.getURL()); if (!origin) return
    if (m.t === 'save' && typeof m.p === 'string' && m.p && typeof m.u === 'string') return this.offerSave(wc, origin, m.u.slice(0, 200), m.p.slice(0, 500))
    if (m.t === 'fill') return void (await this.fill(wc))
  }

  private async offerSave(wc: WebContents, origin: string, username: string, password: string): Promise<void> {
    if (this.busy || this.doc.never.includes(origin) || !this.cipher.available()) return
    const now = Date.now(); if (now - (this.lastSave.get(wc) ?? 0) < 2000) return
    this.lastSave.set(wc, now)
    const cur = this.doc.logins[origin]?.find((x) => x.u === username)
    if (cur && this.cipher.decrypt(cur.p) === password) return // ayni kayit zaten var
    this.busy = true
    try {
      const a = await this.hooks.ask(wc, origin, username, !!cur)
      if (a === 'never') { this.doc.never.push(origin); this.save(); return }
      if (a !== 'save') return
      const list = (this.doc.logins[origin] ??= [])
      const enc = this.cipher.encrypt(password)
      if (cur) { cur.p = enc; cur.ts = Date.now() } else list.push({ u: username, p: enc, ts: Date.now() })
      this.save()
    } finally { this.busy = false }
  }

  /** Bu sekmenin ana belgesindeki giris alanlarini, SAYFANIN KAYNAGIYLA birebir eslesen kayitla doldurur */
  async fill(wc: WebContents): Promise<boolean> {
    if (wc.isDestroyed()) return false
    const origin = originOf(wc.getURL()); if (!origin) return false
    const list = this.doc.logins[origin] ?? []; if (!list.length) return false
    let idx = 0
    if (list.length > 1) { idx = await this.hooks.pick(wc, list.map((x) => x.u)); if (idx < 0) return false }
    if (originOf(wc.getURL()) !== origin) return false // secim sirasinda sayfa degistiyse doldurma
    return !!(await wc.executeJavaScript(fillScript(list[idx].u, this.cipher.decrypt(list[idx].p))).catch(() => false))
  }
}
