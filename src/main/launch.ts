import { isAbsolute, resolve } from 'node:path'

export type Launch = { type: 'dir'; dir: string } | { type: 'url'; url: string }

/**
 * Disaridan gelen istekler (CLI argumani veya izlix:// baglantisi) -> eylem.
 * Guvenlik: yalnizca http(s) adresleri ve mutlak klasor yollari kabul edilir; baska sema reddedilir.
 */
export function parseLaunch(args: string[], cwd = process.cwd()): Launch | null {
  for (const a of args) {
    if (a.startsWith('--open=')) {
      const p = a.slice('--open='.length)
      if (!p) continue
      return { type: 'dir', dir: isAbsolute(p) ? resolve(p) : resolve(cwd, p) }
    }
    if (a.startsWith('izlix://')) {
      try {
        const u = new URL(a)
        if (u.hostname === 'open') {
          const target = u.searchParams.get('url')
          if (target && /^https?:\/\//i.test(target)) { new URL(target); return { type: 'url', url: target } }
          const dir = u.searchParams.get('dir')
          if (dir && isAbsolute(dir)) return { type: 'dir', dir: resolve(dir) }
        }
      } catch { /* gecersiz baglanti yok sayilir */ }
    }
  }
  return null
}
