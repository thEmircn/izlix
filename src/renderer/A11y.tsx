import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, useStore, useT } from './store'
import { CountUp, Seg } from './ui'
import { AxTree } from './AxTree'
import { trAudit } from '../shared/audit-tr'

interface Issue { rule: string; sev: 'error' | 'warn'; selector: string; html: string; detail: string; wcag: string }

const HL = { contentColor: { r: 248, g: 113, b: 113, a: 0.22 }, borderColor: { r: 248, g: 113, b: 113, a: 0.8 }, showInfo: false }

/** Erisilebilirlik denetimi: sayfada hizli WCAG kurallari; sorunlu ogeyi sayfada vurgular. */
export function A11y() {
  const t = useT()
  const lang = useStore((s) => s.settings.language)
  const tabId = useStore((s) => s.activeTabId)
  const [issues, setIssues] = useState<Issue[] | null>(null)
  const [busy, setBusy] = useState(false)
  const [sev, setSev] = useState<'all' | 'error' | 'warn'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const [view, setView] = useState<'rules' | 'tree'>('rules')
  const dt = useCallback((m: string, p?: Record<string, unknown>) => (tabId ? window.izlix.dt(tabId, m, p).catch(() => null) : Promise.resolve(null)) as Promise<any>, [tabId])

  const run = useCallback(async () => {
    if (!tabId) return
    setBusy(true)
    const r = await window.izlix.a11yAudit(tabId)
    setIssues(r?.issues ?? []); setBusy(false)
  }, [tabId])

  useEffect(() => {
    if (!tabId) return
    void window.izlix.dtEnable(tabId, 'elements'); void run()
    return () => { void window.izlix.dt(tabId, 'Overlay.hideHighlight').catch(() => {}); void window.izlix.dtDisable(tabId, 'elements') }
  }, [tabId, run])

  const highlight = async (selector: string | null): Promise<void> => {
    if (!selector) { void dt('Overlay.hideHighlight'); return }
    const doc = await dt('DOM.getDocument', { depth: 0 })
    const q = doc?.root ? await dt('DOM.querySelector', { nodeId: doc.root.nodeId, selector }) : null
    if (q?.nodeId) void dt('Overlay.highlightNode', { nodeId: q.nodeId, highlightConfig: HL })
  }

  const list = useMemo(() => (issues ?? []).filter((i) => sev === 'all' || i.sev === sev), [issues, sev])
  const groups = useMemo(() => { const g = new Map<string, Issue[]>(); for (const i of list) g.set(i.rule, [...(g.get(i.rule) ?? []), i]); return [...g.entries()].sort((a, b) => (b[1][0].sev === 'error' ? 1 : 0) - (a[1][0].sev === 'error' ? 1 : 0) || b[1].length - a[1].length) }, [list])
  const errors = (issues ?? []).filter((i) => i.sev === 'error').length, warns = (issues ?? []).filter((i) => i.sev === 'warn').length

  if (view === 'tree') return <div className="a11y"><div className="net-bar"><Seg<'rules' | 'tree'> small value={view} onChange={setView} items={[{ key: 'rules', label: t('ax.rules') }, { key: 'tree', label: t('ax.tree') }]} /></div><AxTree /></div>
  return (
    <div className="a11y">
      <div className="net-bar">
        <Seg<'rules' | 'tree'> small value={view} onChange={setView} items={[{ key: 'rules', label: t('ax.rules') }, { key: 'tree', label: t('ax.tree') }]} />
        <div className="chips">
          {(['all', 'error', 'warn'] as const).map((k) => <button key={k} className={`fchip ${sev === k ? 'on' : ''} ${k === 'error' ? 'lv-error' : k === 'warn' ? 'lv-warn' : ''}`} onClick={() => setSev(k)}>{t(`a11y.${k}` as any)}</button>)}
        </div>
        <span style={{ flex: 1 }} />
        <button className="btn primary" disabled={busy} onClick={() => void run()}>{busy ? t('a11y.running') : t('a11y.run')}</button>
      </div>
      <div className="net-stats">
        <div className="stat"><span>{t('a11y.errors')}</span><b className={errors ? 'bad' : ''}><CountUp value={errors} /></b></div>
        <div className="stat"><span>{t('a11y.warnings')}</span><b><CountUp value={warns} /></b></div>
        <div className="stat"><span>{t('a11y.rules')}</span><b><CountUp value={groups.length} /></b></div>
      </div>
      <div className="a11y-list">
        {groups.map(([rule, items]) => (
          <div key={rule} className={`agroup ${items[0].sev}`}>
            <div className="ahead" onClick={() => setOpen(open === rule ? null : rule)}>
              <i className="vdot" /><b>{t(`a11y.r.${rule}` as any) === `a11y.r.${rule}` ? rule : t(`a11y.r.${rule}` as any)}</b><code>{rule}</code><span className="cnt">{items.length}</span><em>WCAG {items[0].wcag}</em>
            </div>
            {open === rule && <div className="aitems">{items.slice(0, 40).map((i, k) => (
              <div key={k} className="aitem" onMouseEnter={() => void highlight(i.selector)} onMouseLeave={() => void highlight(null)} onClick={() => { void navigator.clipboard?.writeText(i.selector); toast(t('toast.copied')) }}>
                <code className="sel">{i.selector}</code><div className="adetail">{trAudit(i.detail, lang)}</div><pre className="ahtml">{i.html}</pre>
              </div>))}</div>}
          </div>
        ))}
        {issues && !groups.length && <div className="empty-hint">{t('a11y.clean')}</div>}
        {!issues && <div className="skeleton" style={{ height: 50, margin: 12 }} />}
      </div>
    </div>
  )
}
