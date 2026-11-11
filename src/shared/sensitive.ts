/** Hesap/oturum acma isteklerinin govde ve kimlik basliklari Timeline'a (bellek halka tamponu) hic yazilmaz. */
const AUTH_HOSTS = ['accounts.google.com', 'login.microsoftonline.com', 'login.live.com', 'appleid.apple.com', 'idmsa.apple.com', 'auth0.com', 'okta.com', 'login.yahoo.com', 'id.atlassian.com']
const AUTH_PATH = /(^|\/)(log-?in|sign-?in|signin|signup|sign-?up|auth|oauth2?|token|password|passwd|session|sso|2fa|otp|verify|lookup|challenge)(\/|$|\?|\.)/i
const SECRET_HEADERS = /^(authorization|cookie|set-cookie|proxy-authorization|x-csrf-token|x-xsrf-token)$/i

export function isSensitiveRequest(url: string, method: string, tabSensitive = false): boolean {
  if (tabSensitive) return true
  let u: URL; try { u = new URL(url) } catch { return false }
  if (AUTH_HOSTS.some((h) => u.hostname === h || u.hostname.endsWith('.' + h))) return true
  return method.toUpperCase() !== 'GET' && AUTH_PATH.test(u.pathname)
}

/** Gizli istekte kimlik basliklarinin degerini maskeler */
export function scrubHeaders(h: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!h) return h
  const o: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(h)) o[k] = SECRET_HEADERS.test(k) ? '[gizli]' : v
  return o
}
