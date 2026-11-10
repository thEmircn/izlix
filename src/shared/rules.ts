// Request Rules (MVP #8, "Değiştir"): Workspace başına kurallar. Saf mantık; Electron'a bağımlı değil.

export type RuleAction =
  | { type: 'redirect'; to: string }
  | { type: 'headers'; set: Record<string, string>; remove?: string[] }
  | { type: 'mock'; status: number; body: string; contentType: string }
  | { type: 'delay'; ms: number }
  | { type: 'status'; code: number }

export interface Rule {
  id: string
  name: string
  enabled: boolean
  /** `*` joker karakterli kalıp; joker yoksa URL içinde geçmesi yeterli */
  urlPattern: string
  method?: string
  action: RuleAction
}

export interface RulesConfig {
  rules: Rule[]
  /** kuralların çalışabileceği sayfa alan adları (plan bölüm 11: production'da unutulmuş kural riski) */
  domains: string[]
}

export const DEFAULT_DOMAINS = ['localhost', '127.0.0.1', '*.localhost']

export interface Decision {
  ruleIds: string[]
  kinds: RuleAction['type'][]
  delayMs: number
  redirectTo?: string
  setHeaders: Record<string, string>
  removeHeaders: string[]
  mock?: Extract<RuleAction, { type: 'mock' }>
  status?: number
}

const escapeRe = (s: string): string => s.replace(/[.+?^${}()|[\]\\]/g, '\\$&')

export function matchesPattern(pattern: string, url: string): boolean {
  if (!pattern.includes('*')) return url.includes(pattern)
  return new RegExp('^' + pattern.split('*').map(escapeRe).join('.*') + '$').test(url)
}

/** Sayfa adresinin ana makinesi izinli alan adlarından biri mi? (`*.x.com` alt alan adlarını kapsar) */
export function hostAllowed(pageUrl: string, domains: string[]): boolean {
  let host: string
  try { host = new URL(pageUrl).hostname } catch { return false }
  return domains.some((d) => {
    const dom = d.trim().toLowerCase()
    if (!dom) return false
    if (dom.startsWith('*.')) return host === dom.slice(2) || host.endsWith(dom.slice(1))
    return host === dom
  })
}

export const activeRules = (cfg: RulesConfig): Rule[] => cfg.rules.filter((r) => r.enabled)

/** Bir istek için karar: mock > redirect (ilk eşleşen kazanır), gecikme ve header birikir. Eşleşme yoksa null. */
export function evaluate(rules: Rule[], req: { url: string; method: string }, opts: { ignoreMethod?: boolean } = {}): Decision | null {
  const d: Decision = { ruleIds: [], kinds: [], delayMs: 0, setHeaders: {}, removeHeaders: [] }
  let redirect: string | undefined
  const used: { id: string; kind: RuleAction['type'] }[] = []
  for (const r of rules) {
    if (!r.enabled || !matchesPattern(r.urlPattern, req.url)) continue
    if (!opts.ignoreMethod && r.method && r.method.toUpperCase() !== req.method.toUpperCase()) continue
    const a = r.action
    let ok = true
    switch (a.type) {
      case 'mock': if (!d.mock) d.mock = a; else ok = false; break
      case 'redirect': if (redirect === undefined) redirect = a.to; else ok = false; break
      case 'delay': d.delayMs += a.ms; break
      case 'headers': Object.assign(d.setHeaders, a.set); d.removeHeaders.push(...(a.remove ?? [])); break
      case 'status': if (d.status === undefined) d.status = a.code; else ok = false; break
    }
    if (ok) used.push({ id: r.id, kind: a.type })
  }
  // mock yanıtı döner; yönlendirmenin anlamı kalmaz
  const kept = d.mock ? used.filter((u) => u.kind !== 'redirect') : used
  if (!d.mock) d.redirectTo = redirect
  d.ruleIds = kept.map((u) => u.id); d.kinds = kept.map((u) => u.kind)
  return kept.length ? d : null
}

/** Yalnızca yanıt aşamasında uygulanabilen kural (durum kodu) var mı? Fetch alanı ona göre açılır. */
export const needsResponseStage = (rules: Rule[]): boolean => rules.some((r) => r.enabled && r.action.type === 'status')

export function newRule(partial: Partial<Rule> = {}): Rule {
  return { id: Math.random().toString(36).slice(2, 10), name: 'Yeni kural', enabled: true, urlPattern: '/api/', action: { type: 'mock', status: 200, body: '{"ok":true}', contentType: 'application/json' }, ...partial }
}

/** Timeline'daki bir istekten hizli kural: yol kalibi (sorgu dizesiz) + secilen eylem. */
export function ruleFromRequest(url: string, method: string, kind: 'mock' | 'delay' | 'fail', body?: string | null, contentType?: string): Rule {
  let pattern = url
  try { const u = new URL(url); pattern = u.origin === 'null' ? url : u.origin + u.pathname } catch { /* ham url */ }
  const action: RuleAction = kind === 'mock' ? { type: 'mock', status: 200, body: body ?? '{}', contentType: contentType || 'application/json' }
    : kind === 'delay' ? { type: 'delay', ms: 2000 } : { type: 'status', code: 500 }
  const name = { mock: 'Mock', delay: 'Delay 2s', fail: 'Fail 500' }[kind]
  return newRule({ name: `${name} ${method} ${(() => { try { return new URL(url).pathname } catch { return url } })()}`, urlPattern: pattern, method, action })
}
