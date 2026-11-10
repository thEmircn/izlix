// Dev sunucusu baslatma icin saf yardimcilar.
export type PackageManager = 'pnpm' | 'yarn' | 'bun' | 'npm'

/** Kilit dosyalarina gore paket yoneticisi (var olan dosya adlari verilir) */
export function detectPackageManager(files: string[]): PackageManager {
  if (files.includes('pnpm-lock.yaml')) return 'pnpm'
  if (files.includes('yarn.lock')) return 'yarn'
  if (files.includes('bun.lockb') || files.includes('bun.lock')) return 'bun'
  return 'npm'
}

const PREFERRED = ['dev', 'start', 'serve', 'develop', 'storybook', 'preview']
const rank = (n: string): number => { const i = PREFERRED.indexOf(n); return i < 0 ? 99 : i }
/** package.json script'lerinden calistirilabilir olanlar; dev sunucusuna benzeyenler once */
export function pickScripts(pkg: { scripts?: Record<string, string> } | null): { name: string; cmd: string; likely: boolean }[] {
  const scripts = pkg?.scripts ?? {}
  return Object.entries(scripts)
    .filter(([n]) => !/^(pre|post)/.test(n))
    .map(([name, cmd]) => ({ name, cmd, likely: PREFERRED.includes(name) || /\b(vite|next dev|webpack serve|react-scripts start|astro dev|nuxt dev|remix dev|ng serve)\b/.test(cmd) }))
    .sort((a, b) => Number(b.likely) - Number(a.likely) || rank(a.name) - rank(b.name) || a.name.localeCompare(b.name))
}

export function runCommand(pm: PackageManager, script: string): string {
  if (!/^[\w:.@/-]+$/.test(script)) throw new Error('gecersiz script adi')
  return pm === 'yarn' ? `yarn ${script}` : pm === 'bun' ? `bun run ${script}` : `${pm} run ${script}`
}

// eslint-disable-next-line no-control-regex
const ANSI = /\u001B\[[0-9;?]*[ -/]*[@-~]|\u001B\][^\u0007]*\u0007/g
export const stripAnsi = (s: string): string => s.replace(ANSI, '')

/** Log satirindan yerel sunucu adresi (localhost / 127.0.0.1 / 0.0.0.0 / [::1]) */
export function extractUrl(line: string): string | null {
  const m = /https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\])(?::(\d{2,5}))?[^\s'")]*/i.exec(stripAnsi(line))
  if (!m) return null
  return m[0].replace('0.0.0.0', 'localhost').replace(/[.,;]+$/, '')
}
