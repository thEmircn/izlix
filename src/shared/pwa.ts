// PWA: manifest ozeti, kurulabilirlik kontrolleri ve service worker durumu (CDP ServiceWorker alani olaylarindan). Saf mantik.
export interface Icon { src: string; sizes: string; type?: string; purpose?: string }
export interface Manifest { name: string; shortName: string; startUrl: string; display: string; scope: string; themeColor: string; backgroundColor: string; icons: Icon[] }
export interface Check { id: 'name' | 'startUrl' | 'display' | 'icon192' | 'icon512' | 'maskable' | 'theme'; ok: boolean; required: boolean }

export function parseManifest(data: string | undefined | null): Manifest | null {
  if (!data) return null
  let j: any
  try { j = JSON.parse(data) } catch { return null }
  if (!j || typeof j !== 'object') return null
  const s = (v: unknown): string => (typeof v === 'string' ? v : '')
  const icons: Icon[] = Array.isArray(j.icons) ? j.icons.filter((i: any) => i && typeof i.src === 'string').map((i: any) => ({ src: i.src, sizes: s(i.sizes), type: s(i.type) || undefined, purpose: s(i.purpose) || undefined })) : []
  return { name: s(j.name), shortName: s(j.short_name), startUrl: s(j.start_url), display: s(j.display) || 'browser', scope: s(j.scope), themeColor: s(j.theme_color), backgroundColor: s(j.background_color), icons }
}

const maxSide = (sizes: string): number => Math.max(0, ...sizes.split(/\s+/).map((x) => Number(x.split('x')[0]) || 0))
export function installability(m: Manifest | null): Check[] {
  if (!m) return []
  const big = (n: number): boolean => m.icons.some((i) => maxSide(i.sizes) >= n || /\bany\b/.test(i.sizes) && n <= 192)
  return [
    { id: 'name', ok: !!(m.name || m.shortName), required: true },
    { id: 'startUrl', ok: !!m.startUrl, required: true },
    { id: 'display', ok: ['standalone', 'fullscreen', 'minimal-ui'].includes(m.display), required: true },
    { id: 'icon192', ok: big(192), required: true },
    { id: 'icon512', ok: big(512), required: true },
    { id: 'maskable', ok: m.icons.some((i) => (i.purpose ?? '').includes('maskable')), required: false },
    { id: 'theme', ok: !!m.themeColor, required: false }
  ]
}
export const installable = (checks: Check[]): boolean => checks.length > 0 && checks.filter((c) => c.required).every((c) => c.ok)

export interface SwReg { registrationId: string; scopeURL: string; isDeleted: boolean }
export interface SwVer { versionId: string; registrationId: string; scriptURL: string; runningStatus: string; status: string; controlledClients?: string[] }
export interface SwView { registrationId: string; scope: string; script: string; status: string; running: string; clients: number; versions: { id: string; status: string; running: string }[] }

/** workerRegistrationUpdated / workerVersionUpdated yuklerinden gosterilecek liste: silinen kayitlar ve 'redundant' surumler elenir. */
export function mergeSw(regs: SwReg[], vers: SwVer[]): SwView[] {
  const out: SwView[] = []
  for (const r of regs.filter((x) => !x.isDeleted)) {
    const vs = vers.filter((v) => v.registrationId === r.registrationId && v.status !== 'redundant').sort((a, b) => Number(b.versionId) - Number(a.versionId))
    if (!vs.length) { out.push({ registrationId: r.registrationId, scope: r.scopeURL, script: '', status: 'new', running: 'stopped', clients: 0, versions: [] }); continue }
    const main = vs.find((v) => v.status === 'activated') ?? vs[0]
    out.push({ registrationId: r.registrationId, scope: r.scopeURL, script: main.scriptURL, status: main.status, running: main.runningStatus, clients: main.controlledClients?.length ?? 0, versions: vs.map((v) => ({ id: v.versionId, status: v.status, running: v.runningStatus })) })
  }
  return out
}
