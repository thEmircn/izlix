import { useCallback, useEffect, useState } from 'react'
import { evaluateSeo, scoreOf, type SeoData } from '../shared/seo'
import { useStore, useT } from './store'
import { CountUp } from './ui'

/** Meta/SEO paneli: ozet kartlari, Open Graph onizlemesi ve duzeltilecekler listesi. */
export function Seo() {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [data, setData] = useState<SeoData | null>(null)
  const [busy, setBusy] = useState(false)
  const run = useCallback(async () => { if (!tabId) return; setBusy(true); setData(await window.izlix.seoAudit(tabId)); setBusy(false) }, [tabId])
  useEffect(() => { void run() }, [run])
  if (!data) return <div className="skeleton" style={{ height: 80, margin: 12 }} />
  const issues = evaluateSeo(data), score = scoreOf(issues)
  const fix = issues.filter((i) => i.sev !== 'ok'), ok = issues.filter((i) => i.sev === 'ok')
  const msg = (id: string, d?: string): string => t(`seo.${id}` as any, { d: d ?? '' })
  return (
    <div className="seo">
      <div className="net-bar"><span style={{ color: 'var(--dim)' }}>{t('seo.hint')}</span><span style={{ flex: 1 }} /><button className="btn primary" disabled={busy} onClick={() => void run()}>{busy ? t('a11y.running') : t('a11y.run')}</button></div>
      <div className="seo-top">
        <div className={`vcard ${score >= 85 ? 'good' : score >= 60 ? 'needs' : 'poor'}`} style={{ minWidth: 130 }}>
          <div className="vname">{t('seo.score')}<i className="vdot" /></div>
          <div className="vnum"><CountUp value={score} /><small>/100</small></div>
          <div className="gauge"><b style={{ width: `${score}%` }} /></div>
        </div>
        <div className="ogcard">
          <div className="ogimg">{data.og['og:image'] ? <img src={data.og['og:image']} alt="" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none' }} /> : <span>{t('seo.noImage')}</span>}</div>
          <div className="ogtxt"><small>{(() => { try { return new URL(data.url).host } catch { return '' } })()}</small><b>{data.og['og:title'] || data.title || '—'}</b><span>{data.og['og:description'] || data.description || ''}</span></div>
        </div>
      </div>
      <div className="seo-list">
        {fix.map((i) => <div key={i.id} className={`seoi ${i.sev}`}><i className="vdot" />{msg(i.id, i.detail)}</div>)}
        {!fix.length && <div className="empty-hint">{t('a11y.clean')}</div>}
        {ok.length > 0 && <h4 className="sec" style={{ margin: '10px 0 4px' }}>{t('seo.passed')} ({ok.length})</h4>}
        {ok.map((i) => <div key={i.id} className="seoi ok"><i className="vdot" />{msg(i.id, i.detail)}</div>)}
        <h4 className="sec" style={{ margin: '12px 0 4px' }}>{t('seo.facts')}</h4>
        <div className="kv"><div><span>canonical</span><code>{data.canonical ?? '—'}</code></div><div><span>robots</span><code>{data.robots ?? '—'}</code></div><div><span>lang / charset</span><code>{data.lang ?? '—'} / {data.charset}</code></div>
          <div><span>h1</span><code>{data.h1.join(' | ') || '—'}</code></div><div><span>JSON-LD</span><code>{data.jsonld.map((j) => j.type).join(', ') || '—'}</code></div>
          <div><span>{t('seo.links')}</span><code>{data.links.total} ({data.links.internal} internal, {data.links.external} external, {data.links.nofollow} nofollow)</code></div><div><span>{t('seo.images')}</span><code>{data.images.total} ({data.images.noAlt} without alt)</code></div></div>
      </div>
    </div>
  )
}
