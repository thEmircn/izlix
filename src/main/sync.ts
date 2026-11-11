import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { homedir, hostname } from 'node:os'
import { join } from 'node:path'
import { isPayload, type SyncPayload } from '../shared/sync'

/** iCloud Drive klasoru (sunucusuz): dosya uctan uca sifreli oldugu icin iCloud yalniz anlamsiz bayt gorur. */
export function icloudDir(): string {
  return process.env.DB_ICLOUD_DIR ?? join(homedir(), 'Library', 'Mobile Documents', 'com~apple~CloudDocs', 'Izlix')
}
export const SYNC_FILE = 'sync.dbsync'

interface Envelope { v: 1; salt: string; iv: string; tag: string; data: string }

/** Parola -> scrypt anahtari -> AES-256-GCM. Kimlik dogrulamali: yanlis parola veya bozuk dosya cozulmez. */
export function encryptPayload(p: SyncPayload, pass: string): string {
  const salt = randomBytes(16), iv = randomBytes(12)
  const key = scryptSync(pass, salt, 32)
  const c = createCipheriv('aes-256-gcm', key, iv)
  const data = Buffer.concat([c.update(JSON.stringify(p), 'utf8'), c.final()])
  const env: Envelope = { v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }
  return JSON.stringify(env)
}

export function decryptPayload(text: string, pass: string): SyncPayload {
  let env: Envelope
  try { env = JSON.parse(text) as Envelope } catch { throw new Error('corrupt') }
  if (!env || env.v !== 1) throw new Error('corrupt')
  try {
    const key = scryptSync(pass, Buffer.from(env.salt, 'base64'), 32)
    const d = createDecipheriv('aes-256-gcm', key, Buffer.from(env.iv, 'base64')); d.setAuthTag(Buffer.from(env.tag, 'base64'))
    const out = JSON.parse(Buffer.concat([d.update(Buffer.from(env.data, 'base64')), d.final()]).toString('utf8'))
    if (!isPayload(out)) throw new Error('corrupt')
    return out
  } catch (e) { throw new Error((e as Error).message === 'corrupt' ? 'corrupt' : 'bad-pass') }
}

export interface SyncResult { ok: boolean; error?: 'no-icloud' | 'bad-pass' | 'corrupt' | 'no-pass'; pulled?: boolean; ts?: number }

/** Esitleme: uzak dosya varsa coz + birlestir (apply), sonra birlesik hali yaz (atomik rename). */
export class SyncService {
  constructor(private deps: { build: () => SyncPayload; apply: (remote: SyncPayload) => void; pass: () => string | null; dir?: () => string }) {}
  dir(): string { return this.deps.dir?.() ?? icloudDir() }
  /** iCloud Drive mevcut mu (ust klasor var mi); test dizini ayri verilirse olusturulur */
  available(): boolean { const d = this.dir(); return existsSync(d) || existsSync(join(d, '..')) }
  run(): SyncResult {
    const pass = this.deps.pass(); if (!pass) return { ok: false, error: 'no-pass' }
    if (!this.available()) return { ok: false, error: 'no-icloud' }
    const dir = this.dir(), file = join(dir, SYNC_FILE); let pulled = false
    if (existsSync(file)) {
      try { this.deps.apply(decryptPayload(readFileSync(file, 'utf8'), pass)); pulled = true } catch (e) { return { ok: false, error: (e as Error).message === 'corrupt' ? 'corrupt' : 'bad-pass' } }
    }
    mkdirSync(dir, { recursive: true })
    const merged = this.deps.build(); const tmp = file + '.tmp'
    writeFileSync(tmp, encryptPayload(merged, pass)); renameSync(tmp, file)
    return { ok: true, pulled, ts: merged.ts }
  }
}
export const deviceName = (): string => hostname()
