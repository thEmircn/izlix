// JWT inceleme (imza DOGRULANMAZ; yalnizca baslik/yuk okunur). Saf mantik.
export interface Jwt { raw: string; header: Record<string, unknown>; payload: Record<string, unknown>; exp?: number; iat?: number; nbf?: number }

const b64url = (s: string): string => {
  const p = s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)
  // atob: tarayici, eklenti ve Node 16+ icin ortak (Buffer yedegi cekirdek sinirini bozuyordu)
  return decodeURIComponent(Array.from(atob(p), (c) => '%' + c.charCodeAt(0).toString(16).padStart(2, '0')).join(''))
}

export function decodeJwt(token: string): Jwt | null {
  const parts = token.trim().split('.')
  if (parts.length !== 3 || !parts[0].startsWith('eyJ')) return null
  try {
    const header = JSON.parse(b64url(parts[0])), payload = JSON.parse(b64url(parts[1]))
    if (typeof header !== 'object' || typeof payload !== 'object' || !header || !payload) return null
    const num = (v: unknown): number | undefined => (typeof v === 'number' && Number.isFinite(v) ? v : undefined)
    return { raw: token.trim(), header, payload, exp: num(payload.exp), iat: num(payload.iat), nbf: num(payload.nbf) }
  } catch { return null }
}

const RE = /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g
/** Metinde gecen tum JWT'ler (tekrarsiz) */
export function findJwts(text: string): Jwt[] {
  const out: Jwt[] = [], seen = new Set<string>()
  for (const m of text.match(RE) ?? []) { if (seen.has(m)) continue; seen.add(m); const j = decodeJwt(m); if (j) out.push(j) }
  return out
}

export type Expiry = { state: 'none' } | { state: 'valid' | 'expired' | 'notyet'; deltaSec: number }
export function expiryOf(j: Jwt, nowSec = Date.now() / 1000): Expiry {
  if (j.nbf !== undefined && nowSec < j.nbf) return { state: 'notyet', deltaSec: Math.round(j.nbf - nowSec) }
  if (j.exp === undefined) return { state: 'none' }
  return j.exp > nowSec ? { state: 'valid', deltaSec: Math.round(j.exp - nowSec) } : { state: 'expired', deltaSec: Math.round(nowSec - j.exp) }
}

export function humanDelta(sec: number): string {
  const s = Math.abs(sec)
  if (s < 90) return `${s}s`
  if (s < 5400) return `${Math.round(s / 60)} min`
  if (s < 129600) return `${Math.round(s / 3600)} h`
  return `${Math.round(s / 86400)} d`
}
