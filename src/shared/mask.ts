// Hassas veri maskeleme (plan bolum 11): Authorization, Cookie, Set-Cookie ve JWT'ler rapor ve HAR'dan otomatik maskelenir.
export const MASK = '[MASKED]'
export const SENSITIVE_KEYS = /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key|x-auth-token|x-csrf-token|x-xsrf-token|password|passwd|secret|client_secret|access_token|refresh_token|id_token|api_key|apikey|token)$/i
const JWT = /eyJ[A-Za-z0-9_-]{5,}\.eyJ[A-Za-z0-9_-]{5,}\.[A-Za-z0-9_-]*/g
const BEARER = /\b(Bearer|Basic)\s+[A-Za-z0-9._~+/=-]{8,}/gi
const QUERY_SECRET = /([?&](?:access_token|refresh_token|id_token|token|api_key|apikey|key|secret|password|sig|signature)=)[^&#\s"']+/gi

export function maskString(s: string): string {
  return s.replace(JWT, MASK).replace(BEARER, `$1 ${MASK}`).replace(QUERY_SECRET, `$1${MASK}`)
}

/** Nesneyi derin gezip hassas anahtarlarin degerlerini ve metinlerdeki JWT/Bearer/token kaliplarini maskeler (girdiyi degistirmez). */
export function maskDeep<T>(v: T, depth = 0): T {
  if (depth > 12) return v
  if (typeof v === 'string') return maskString(v) as T
  if (Array.isArray(v)) return v.map((x) => maskDeep(x, depth + 1)) as T
  if (v && typeof v === 'object') {
    const out: Record<string, unknown> = {}
    for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
      out[k] = SENSITIVE_KEYS.test(k) && val != null && typeof val !== 'object' ? MASK : maskDeep(val, depth + 1)
    }
    return out as T
  }
  return v
}
