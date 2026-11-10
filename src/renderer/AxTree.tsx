import { useCallback, useEffect, useMemo, useState } from 'react'
import { buildAxTree, flattenAx, INTERACTIVE, LANDMARKS, markIssues, summarizeAx, type AxNode, type AxRaw } from '../shared/axtree'
import { useStore, useT } from './store'
import { CountUp } from './ui'

const HL = { contentColor: { r: 255, g: 106, b: 43, a: 0.2 }, borderColor: { r: 255, g: 106, b: 43, a: 0.85 }, showInfo: false }
const roleClass = (r: string): string => (LANDMARKS.has(r) ? 'lm' : INTERACTIVE.has(r) ? 'ia' : r === 'heading' ? 'hd' : r === 'img' || r === 'image' ? 'im' : '')

/** Erisilebilirlik agaci: tarayicinin ekran okuyucuya sundugu rol/ad/ozellik agaci; sorunlu dugumler isaretlenir, uzerine gelince sayfada vurgulanir. */
export function AxTree() {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [root, setRoot] = useState<AxNode | null | undefined>(undefined)
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [q, setQ] = useState('')
  const [onlyIssues, setOnlyIssues] = useState(false)
  const dt = useCallback((m: string, p?: Record<string, unknown>) => (tabId ? window.izlix.dt(tabId, m, p).catch(() => null) : Promise.resolve(null)) as Promise<any>, [tabId])

  const load = useCallback(async () => {
    setRoot(undefined)
    const r = await dt('Accessibility.getFullAXTree')
    const tree = buildAxTree((r?.nodes ?? []) as AxRaw[])
    if (tree) markIssues(tree)
    setRoot(tree)
  }, [dt])
  useEffect(() => { void load() }, [load])

  const sum = useMemo(() => summarizeAx(root ?? null), [root])
  const rows = useMemo(() => (root ? flattenAx(root, collapsed, { q, onlyIssues }) : []), [root, collapsed, q, onlyIssues])
  const hl = async (n: AxNode | null): Promise<void> => {
    if (!n?.backendId) { void dt('Overlay.hideHighlight'); return }
    await dt('DOM.getDocument', { depth: 0 })
    const r = await dt('DOM.pushNodesByBackendIdsToFrontend', { backendNodeIds: [n.backendId] })
    if (r?.nodeIds?.[0]) void dt('Overlay.highlightNode', { nodeId: r.nodeIds[0], highlightConfig: HL })
  }
  const toggle = (id: string): void => setCollapsed((c) => { const x = new Set(c); x.has(id) ? x.delete(id) : x.add(id); return x })

  return (
    <div className="axt">
      <div className="net-stats">
        <div className="stat"><span>{t('ax.nodes')}</span><b><CountUp value={sum.nodes} /></b></div>
        <div className="stat"><span>{t('ax.landmarks')}</span><b>{sum.landmarks}</b></div>
        <div className="stat"><span>{t('ax.headings')}</span><b>{sum.headings}</b></div>
        <div className="stat"><span>{t('ax.issues')}</span><b className={sum.issues ? 'bad' : ''}><CountUp value={sum.issues} /></b></div>
      </div>
      <div className="net-bar">
        <input className="search" placeholder={t('ax.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className={`fchip ${onlyIssues ? 'on' : ''}`} onClick={() => setOnlyIssues(!onlyIssues)}>{t('ax.onlyIssues')}</button>
        <button className="btn" onClick={() => void load()}>{t('insp.refresh')}</button>
      </div>
      <div className="ax-list" onMouseLeave={() => void hl(null)}>
        {root === undefined && <div className="skeleton" style={{ height: 50, margin: 12 }} />}
        {root === null && <div className="empty-hint">{t('ax.none')}</div>}
        {rows.slice(0, 1500).map(({ node: n, depth, hasKids }) => (
          <div key={n.id} className={`ax-row ${n.issue ? 'issue' : ''}`} style={{ paddingLeft: 8 + depth * 14 }} onMouseEnter={() => void hl(n)}>
            <b className={`ax-t ${hasKids ? (collapsed.has(n.id) ? '' : 'open') : 'leaf'}`} onClick={() => hasKids && toggle(n.id)}>›</b>
            <span className={`ax-role ${roleClass(n.role)}`}>{n.role}</span>
            <span className="ax-name">{n.name ? `“${n.name}”` : <em>{t('ax.noName')}</em>}</span>
            {Object.entries(n.props).map(([k, v]) => <span key={k} className="ax-prop">{k}{v !== 'true' ? `=${v.length > 24 ? v.slice(0, 24) + '…' : v}` : ''}</span>)}
            {n.issue && <span className="ax-issue">{t(`ax.i.${n.issue}` as any)}</span>}
          </div>
        ))}
        {rows.length > 1500 && <div className="empty-hint">+{rows.length - 1500}</div>}
        {root && !rows.length && <div className="empty-hint">{t('ax.empty')}</div>}
      </div>
    </div>
  )
}
