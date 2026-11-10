import { net, protocol, type BrowserWindow, type Session, type WebContents } from 'electron'
import { join, normalize, resolve, sep } from 'node:path'
import { pathToFileURL } from 'node:url'

/** app://shell/<yol> -> yerel dosya yolu; kok disina cikan (../) yollar null doner. */
export function resolveAppPath(root: string, urlPath: string): string | null {
  let p: string
  try { p = decodeURIComponent(urlPath) } catch { return null }
  if (p.includes('\0')) return null
  const full = normalize(join(root, p === '/' || p === '' ? 'index.html' : p))
  return full === root || full.startsWith(root + sep) ? full : null
}

/** Shell, app:// ozel protokolunden yuklenir (plan bolum 4). Protokol app.ready'den ONCE tanitilmali. */
export function registerAppScheme(): void {
  protocol.registerSchemesAsPrivileged([{ scheme: 'app', privileges: { standard: true, secure: true, supportFetchAPI: true } }])
}
export function serveApp(root: string): void {
  protocol.handle('app', (req) => {
    const u = new URL(req.url)
    if (u.hostname !== 'shell') return new Response('not found', { status: 404 })
    const file = resolveAppPath(root, u.pathname)
    return file ? net.fetch(pathToFileURL(file).toString()) : new Response('forbidden', { status: 403 })
  })
}

/** Kamera, mikrofon, konum, bildirim vb. varsayilan olarak reddedilir (Permission Dashboard'a kadar). */
export function lockPermissions(ses: Session, allow: (wc: WebContents | null, permission: string) => boolean = () => false): void {
  ses.setPermissionRequestHandler((wc, perm, cb) => cb(allow(wc, perm)))
  ses.setPermissionCheckHandler((wc, perm) => allow(wc, perm))
}

/** Shell penceresi hicbir zaman baska yere gezinmez ve yeni pencere/webview acamaz. */
export function lockShell(win: BrowserWindow, allowedPrefixes: string[]): void {
  const wc = win.webContents
  wc.on('will-navigate', (e, url) => { if (!allowedPrefixes.some((p) => url.startsWith(p))) e.preventDefault() })
  wc.on('will-attach-webview', (e) => e.preventDefault())
  wc.setWindowOpenHandler(() => ({ action: 'deny' }))
}

/** Dosya, guvenilir koklerden birinin ALTINDA mi? (yol gecisi `..` cozulerek denetlenir; kokun kendisi dosya sayilmaz) */
export function isInsideAny(roots: (string | null | undefined)[], file: string): boolean {
  if (!file || file.includes('\0')) return false
  const f = resolve(file)
  return roots.some((r) => { if (!r) return false; const root = resolve(r); return f.startsWith(root + sep) })
}

/** Yalnizca loopback adresleri: kendinden imzali yerel dev sertifikalarini kabul etmek icin */
export const isLoopbackHost = (host: string): boolean => host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1' || host === '[::1]'

/** Yerel HTTPS dev sunuculari (Vite basicSsl, mkcert'siz) calissin; baska hicbir alan adi icin dogrulama gevsemez. */
export function trustLoopbackCerts(ses: Session): void {
  ses.setCertificateVerifyProc((req, cb) => cb(isLoopbackHost(req.hostname) ? 0 : -3)) // 0 = kabul, -3 = varsayilan dogrulama
}
