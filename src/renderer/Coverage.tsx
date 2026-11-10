import { useEffect, useRef, useState } from 'react'
import { mergeCss, selectorOfRuleText, summarizeScripts, type CssUsage, type ScriptRow } from '../shared/coverage'
import { formatBytes } from '../shared/network'
import { useStore, useT } from './store'
import { CountUp } from './ui'

interface Result { scripts: ScriptRow[]; css: ReturnType<typeof mergeCss> }

/** Coverage: kayit sirasinda calisan/calismayan JS ve CSS (kullanilmayan kodu bul). */
export function Coverage() {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [state, setState] = useState<'idle' | 'recording' | 'analyzing'>('idle')
  const [result, setResult] = useState<Result | null>(null)
  const [secs, setSecs] = useState(0)
  const active = useRef(false)
  // gezinmede CSS kural izleme sifirlanir: kayit sirasinda her yeni belgede yeniden baslat
  const navId = useStore((s) => { if (state !== 'recording') return 0; let id = 0; for (const e of s.events.values()) if (e.kind === 'navigation' && e.source === 'cdp:Page.frameNavigated' && e.id > id) id = e.id; return id })
  const lastNav = useRef(0)
  useEffect(() => { if (state === 'recording' && navId && navId !== lastNav.current) { if (lastNav.current) void window.izlix.dt(tabId!, 'CSS.startRuleUsageTracking').catch(() => {}); lastNav.current = navId } }, [navId, state])
  const dt = (m: string, p?: Record<string, unknown>): Promise<any> => (tabId ? window.izlix.dt(tabId, m, p).catch(() => null) : Promise.resolve(null))

  useEffect(() => () => { if (active.current && tabId) { void window.izlix.dt(tabId, 'Profiler.stopPreciseCoverage').catch(() => {}); void window.izlix.dtDisable(tabId, 'coverage') } }, [tabId])
  useEffect(() => { if (state !== 'recording') return; setSecs(0); const h = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(h) }, [state])

  const start = async (reload: boolean): Promise<void> => {
    if (!tabId) return
    setResult(null)
    await window.izlix.dtEnable(tabId, 'coverage')
    await dt('Profiler.startPreciseCoverage', { callCount: false, detailed: false })
    await dt('CSS.startRuleUsageTracking')
    active.current = true; lastNav.current = 0; setState('recording')
    if (reload) await window.izlix.reload(tabId)
  }
  const stop = async (): Promise<void> => {
    if (!tabId) return
    setState('analyzing')
    const js = await dt('Profiler.takePreciseCoverage')
    const css = await dt('CSS.stopRuleUsageTracking')
    await dt('Profiler.stopPreciseCoverage')
    const usage: CssUsage[] = css?.ruleUsage ?? []
    // CDP yalnizca KULLANILAN kurallari bildirir: onlarin seciciklerini stylesheet metninden cikar, anlik taramayla birlestir
    const texts = new Map<string, string>(), usedSel: string[] = []
    for (const r of usage.filter((x) => x.used)) {
      if (!texts.has(r.styleSheetId)) texts.set(r.styleSheetId, (await dt('CSS.getStyleSheetText', { styleSheetId: r.styleSheetId }))?.text ?? '')
      const sel = selectorOfRuleText((texts.get(r.styleSheetId) ?? '').slice(r.startOffset, r.endOffset))
      if (sel) usedSel.push(sel)
    }
    const snap = (await window.izlix.cssSnapshot(tabId)) ?? []
    setResult({ scripts: summarizeScripts(js?.result ?? []), css: mergeCss(snap, usedSel) })
    await window.izlix.dtDisable(tabId, 'coverage'); active.current = false
    setState('idle')
  }

  const totalUnused = result?.scripts.reduce((a, r) => a + r.unused, 0) ?? 0, totalBytes = result?.scripts.reduce((a, r) => a + r.total, 0) ?? 0
  return (
    <div className="cov">
      <div className="net-bar">
        <span style={{ color: 'var(--dim)' }}>{state === 'recording' ? t('cov.recording', { s: secs }) : t('cov.hint')}</span>
        <span style={{ flex: 1 }} />
        {state === 'recording'
          ? <button className="btn primary" onClick={() => void stop()}>{t('cov.stop')}</button>
          : <><button className="btn" disabled={state === 'analyzing'} onClick={() => void start(false)}>{t('cov.record')}</button><button className="btn primary" disabled={state === 'analyzing'} onClick={() => void start(true)}>{t('cov.reloadRecord')}</button></>}
      </div>
      {state === 'analyzing' && <div className="skeleton" style={{ height: 60, margin: 12 }} />}
      {result && (
        <div className="cov-body">
          <div className="net-stats">
            <div className="stat"><span>{t('cov.jsUnused')}</span><b className={totalBytes && totalUnused / totalBytes > 0.5 ? 'bad' : ''}><CountUp value={totalBytes ? Math.round((totalUnused / totalBytes) * 100) : 0} />%</b></div>
            <div className="stat"><span>{t('cov.jsBytes')}</span><b>{formatBytes(totalUnused)}</b></div>
            <div className="stat"><span>{t('cov.cssUnused')}</span><b><CountUp value={100 - result.css.pct} />%</b></div>
            <div className="stat"><span>{t('cov.cssRules')}</span><b>{result.css.unused}/{result.css.rules}</b></div>
          </div>
          <h4 className="sec">{t('cov.scripts')}</h4>
          <div className="covlist">{result.scripts.slice(0, 60).map((r) => (
            <div key={r.url} className="covrow"><span className="u" title={r.url}>{r.url.replace(/^https?:\/\/[^/]+/, '').split('?')[0] || r.url}</span><div className="covbar"><b className={r.pct < 50 ? 'low' : ''} style={{ width: `${r.pct}%` }} /></div><code>{r.pct}%</code><code>{formatBytes(r.unused)}</code></div>
          ))}{!result.scripts.length && <div className="empty-hint">{t('cov.none')}</div>}</div>
          {result.css.unusedSelectors.length > 0 && <><h4 className="sec">{t('cov.unusedCss')}</h4><div className="selist">{result.css.unusedSelectors.slice(0, 60).map((s) => <code key={s.sel} title={s.url}>{s.sel}</code>)}</div></>}
        </div>
      )}
      {!result && state === 'idle' && <div className="empty-hint">{t('cov.empty')}</div>}
    </div>
  )
}
