import { app } from 'electron'
import { loadDoc, saveDoc } from './docdb'
import { join } from 'node:path'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'

export type Decision = 'allow' | 'deny'
/** Kullaniciya sorulabilen izinler */
export const PROMPTABLE = ['camera', 'microphone', 'geolocation', 'notifications', 'clipboard-read', 'midi', 'display-capture'] as const
export type PermKey = (typeof PROMPTABLE)[number]
/** Sormadan izin verilenler (kullanici hareketiyle sinirli, dusuk risk) */
const AUTO_ALLOW = new Set(['clipboard-sanitized-write', 'fullscreen', 'pointerLock', 'keyboardLock'])

/** Electron izin adi + ayrintilari -> bizim anahtar; null: sormadan reddet. 'auto': sormadan izin ver. */
export function permissionKey(permission: string, details?: { mediaTypes?: string[] }): PermKey | 'auto' | null {
  if (AUTO_ALLOW.has(permission)) return 'auto'
  if (permission === 'media') {
    const t = details?.mediaTypes ?? []
    if (t.includes('video')) return 'camera'
    if (t.includes('audio')) return 'microphone'
    return null
  }
  if (permission === 'geolocation' || permission === 'notifications' || permission === 'midi' || permission === 'clipboard-read' || permission === 'display-capture') return permission as PermKey
  return null
}

export class PermissionStore {
  private data: Record<string, Decision> = {}
  private dir: string
  constructor(dir = app.getPath('userData')) {
    this.dir = dir
    this.data = loadDoc<Record<string, Decision>>(dir, 'permissions') ?? {}
  }
  private k = (origin: string, perm: string): string => `${origin}|${perm}`
  get(origin: string, perm: string): Decision | undefined { return this.data[this.k(origin, perm)] }
  set(origin: string, perm: string, d: Decision): void { this.data[this.k(origin, perm)] = d; this.save() }
  remove(origin: string, perm: string): void { delete this.data[this.k(origin, perm)]; this.save() }
  list(): { origin: string; permission: string; decision: Decision }[] { return Object.entries(this.data).map(([k, decision]) => { const [origin, permission] = k.split('|'); return { origin, permission, decision } }) }
  private save(): void { saveDoc(this.dir, 'permissions', this.data) }
}

export const originOf = (url: string): string => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : '' } catch { return '' } }
