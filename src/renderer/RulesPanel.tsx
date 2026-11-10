import { useState } from 'react'
import { parseRulesJson, newRule, type Rule, type RuleAction, type RulesConfig } from '../shared/rules'
import { useStore, useT } from './store'

const TYPES: RuleAction['type'][] = ['mock', 'delay', 'status', 'redirect', 'headers']
const defaultAction = (t: RuleAction['type']): RuleAction => {
  switch (t) {
    case 'mock': return { type: 'mock', status: 200, body: '{"ok":true}', contentType: 'application/json' }
    case 'delay': return { type: 'delay', ms: 1000 }
    case 'status': return { type: 'status', code: 500 }
    case 'redirect': return { type: 'redirect', to: 'http://localhost:3000/' }
    case 'headers': return { type: 'headers', set: { 'X-Debug': '1' }, remove: [] }
  }
}
const headersToText = (h: Record<string, string>): string => Object.entries(h).map(([k, v]) => `${k}: ${v}`).join('\n')
const textToHeaders = (t: string): Record<string, string> => Object.fromEntries(t.split('\n').map((l) => l.split(/:\s*(.*)/s)).filter((p) => p[0]?.trim()).map((p) => [p[0].trim(), (p[1] ?? '').trim()]))

/** Request Rules editörü: Workspace başına kurallar (yönlendirme, header, JSON mock, gecikme, durum kodu). */
export function RulesPanel({ onClose }: { onClose(): void }) {
  const t = useT()
  const wsId = useStore((s) => s.activeWorkspaceId)
  const wsName = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId)?.name)
  const stored = useStore((s) => s.rules[s.activeWorkspaceId])
  const [cfg, setCfg] = useState<RulesConfig>(() => stored ? structuredClone(stored) : { rules: [], domains: ['localhost', '127.0.0.1', '*.localhost'] })
  const upd = (id: string, p: Partial<Rule>): void => setCfg((c) => ({ ...c, rules: c.rules.map((r) => r.id === id ? { ...r, ...p } : r) }))
  const [importing, setImporting] = useState<string | null>(null)
  const [bad, setBad] = useState(false)
  const doImport = (): void => {
    const r = parseRulesJson(importing ?? '')
    if (!r) { setBad(true); return }
    setCfg((c) => ({ rules: [...c.rules, ...r.rules], domains: r.domains?.length ? r.domains : c.domains })); setImporting(null); setBad(false)
  }
  const save = async (): Promise<void> => { await window.izlix.setRules(wsId, cfg); void window.izlix.track('rules.saved', { rules: cfg.rules.length }); onClose() }

  return (
    <div className="overlay" style={{ paddingTop: '6vh' }} onMouseDown={onClose}>
      <div className="dialog" style={{ width: 'min(820px, 94vw)', maxHeight: '86vh' }} role="dialog" aria-label="Request Rules" onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--line)', display: 'flex', gap: 10, alignItems: 'center' }}>
          <b style={{ flex: 1 }}>{t('rr.title', { ws: wsName ?? '' })}</b>
          <button className="btn" onClick={() => setCfg((c) => ({ ...c, rules: [...c.rules, newRule()] }))}>{t('rr.add')}</button>
          <button className="btn" onClick={() => void navigator.clipboard?.writeText(JSON.stringify(cfg, null, 1)).catch(() => {})}>{t('rr.copy')}</button>
          <button className="btn" onClick={() => setImporting(importing === null ? '' : null)}>{t('rr.import')}</button>
          <button className="btn primary" onClick={save}>{t('rr.save')}</button>
          <button className="btn" onClick={onClose}>{t('rr.close')}</button>
        </div>
        <div style={{ overflow: 'auto', padding: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
          {importing !== null && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ color: bad ? '#ff5c5c' : 'var(--dim)' }}>{bad ? t('rr.importBad') : t('rr.importHint')}</div>
              <textarea rows={5} aria-label={t('rr.import')} value={importing} onChange={(e) => { setImporting(e.target.value); setBad(false) }} />
              <div><button className="btn primary" onClick={doImport}>{t('rr.import')}</button></div>
            </div>
          )}
          <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {t('rr.domains')}
            <input style={{ flex: 1 }} value={cfg.domains.join(', ')} onChange={(e) => setCfg({ ...cfg, domains: e.target.value.split(',').map((d) => d.trim()).filter(Boolean) })} />
          </label>
          <div style={{ color: 'var(--dim)' }}>{t('rr.domainsHint')}</div>
          {cfg.rules.map((r) => (
            <div key={r.id} style={{ border: '1px solid var(--line)', borderRadius: 7, padding: 8, display: 'flex', flexDirection: 'column', gap: 6, opacity: r.enabled ? 1 : 0.55 }}>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                <input type="checkbox" aria-label={t('rr.enabled')} checked={r.enabled} onChange={(e) => upd(r.id, { enabled: e.target.checked })} />
                <input style={{ width: 150 }} value={r.name} onChange={(e) => upd(r.id, { name: e.target.value })} />
                <select value={r.method ?? ''} onChange={(e) => upd(r.id, { method: e.target.value || undefined })}>
                  <option value="">{t('rr.allMethods')}</option>{['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].map((m) => <option key={m}>{m}</option>)}
                </select>
                <input style={{ flex: 1 }} placeholder={t('rr.pattern')} value={r.urlPattern} onChange={(e) => upd(r.id, { urlPattern: e.target.value })} />
                <button className="btn" aria-label={t('rr.delete')} onClick={() => setCfg((c) => ({ ...c, rules: c.rules.filter((x) => x.id !== r.id) }))}>🗑</button>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                <select value={r.action.type} onChange={(e) => upd(r.id, { action: defaultAction(e.target.value as RuleAction['type']) })}>
                  {TYPES.map((t) => <option key={t}>{t}</option>)}
                </select>
                <ActionFields a={r.action} onChange={(action) => upd(r.id, { action })} />
              </div>
            </div>
          ))}
          {!cfg.rules.length && <div style={{ color: 'var(--dim)' }}>{t('rr.none')}</div>}
        </div>
      </div>
    </div>
  )
}

function ActionFields({ a, onChange }: { a: RuleAction; onChange(a: RuleAction): void }) {
  const t = useT()
  const num = (v: string): number => Math.max(0, Math.floor(Number(v) || 0))
  switch (a.type) {
    case 'delay': return <label>{t('rr.delay')} <input style={{ width: 90 }} value={a.ms} onChange={(e) => onChange({ ...a, ms: Math.min(60000, num(e.target.value)) })} /></label>
    case 'status': return <label>{t('rr.status')} <input style={{ width: 70 }} value={a.code} onChange={(e) => onChange({ ...a, code: Math.min(599, Math.max(100, num(e.target.value))) })} /> <span style={{ color: 'var(--dim)' }}>{t('rr.statusHint')}</span></label>
    case 'redirect': return <input style={{ flex: 1 }} value={a.to} placeholder="http://localhost:4000/api/..." onChange={(e) => onChange({ ...a, to: e.target.value })} />
    case 'headers': return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <textarea rows={3} aria-label={t('rr.headersAdd')} placeholder={t('rr.headersHint')} value={headersToText(a.set)} onChange={(e) => onChange({ ...a, set: textToHeaders(e.target.value) })} />
        <input aria-label={t('rr.headersRemove')} placeholder={t('rr.headersRemoveHint')} value={(a.remove ?? []).join(', ')} onChange={(e) => onChange({ ...a, remove: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })} />
      </div>
    )
    case 'mock': return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <label>{t('rr.mockStatus')} <input style={{ width: 60 }} value={a.status} onChange={(e) => onChange({ ...a, status: Math.min(599, Math.max(100, num(e.target.value))) })} /></label>
          <input style={{ flex: 1 }} value={a.contentType} onChange={(e) => onChange({ ...a, contentType: e.target.value })} />
        </div>
        <textarea rows={4} spellCheck={false} style={{ font: '12px ui-monospace, Menlo, monospace' }} value={a.body} onChange={(e) => onChange({ ...a, body: e.target.value })} />
      </div>
    )
  }
}
