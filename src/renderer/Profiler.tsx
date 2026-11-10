import { useEffect, useMemo, useRef, useState } from 'react'
import { analyzeProfile, type Analysis, type CpuProfile, type FlameNode } from '../shared/profile'
import { useStore, useT } from './store'
import { CountUp } from './ui'

const fmt = (ms: number): string => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${ms.toFixed(ms < 10 ? 1 : 0)} ms`)
const shortUrl = (u: string): string => u.replace(/^https?:\/\/[^/]+/, '').split('?')[0] || u
const hue = (name: string): number => { let h = 0; for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % 360; return h }

function openAt(url: string, line: number): void {
  if (/^https?:/.test(url)) useStore.getState().set({ panelTab: 'sources', sourceTarget: { url, line, col: 1 } })
}

function Flame({ root, totalMs, maxDepth }: { root: FlameNode; totalMs: number; maxDepth: number }) {
  const [hover, setHover] = useState<FlameNode | null>(null)
  const boxes: FlameNode[] = []
  const walk = (n: FlameNode): void => { if (n.total / totalMs >= 0.004) { boxes.push(n); n.children.forEach(walk) } }
  walk(root)
  return (
    <div className="flame" style={{ height: (maxDepth + 1) * 18 + 4 }}>
      {boxes.map((n) => (
        <div key={n.id} className="fl" title={`${n.name}  ${fmt(n.total)} (self ${fmt(n.self)})\n${shortUrl(n.url)}:${n.line}`}
          style={{ left: `${(n.start / totalMs) * 100}%`, width: `${(n.total / totalMs) * 100}%`, top: n.depth * 18, background: `hsl(${hue(n.name)} 18% ${n.self / Math.max(n.total, 0.001) > 0.5 ? 38 : 26}%)` }}
          onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(null)} onClick={() => openAt(n.url, n.line)}>
          <span>{n.name}</span>
        </div>
      ))}
      {hover && <div className="fl-tip">{hover.name} · {fmt(hover.total)} · {shortUrl(hover.url)}:{hover.line}</div>}
    </div>
  )
}

/** Profiler: CPU profili kaydi (CDP Profiler), en agir fonksiyonlar ve alev grafigi. */
export function Profiler() {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [state, setState] = useState<'idle' | 'recording' | 'analyzing'>('idle')
  const [result, setResult] = useState<Analysis | null>(null)
  const [secs, setSecs] = useState(0)
  const active = useRef(false)
  const dt = (m: string, p?: Record<string, unknown>): Promise<any> => (tabId ? window.izlix.dt(tabId, m, p).catch(() => null) : Promise.resolve(null))

  useEffect(() => () => { if (active.current && tabId) { void window.izlix.dt(tabId, 'Profiler.stop').catch(() => {}); void window.izlix.dtDisable(tabId, 'profile') } }, [tabId])
  useEffect(() => { if (state !== 'recording') return; setSecs(0); const h = setInterval(() => setSecs((x) => x + 1), 1000); return () => clearInterval(h) }, [state])

  const start = async (reload: boolean): Promise<void> => {
    if (!tabId) return
    setResult(null)
    await window.izlix.dtEnable(tabId, 'profile')
    await dt('Profiler.setSamplingInterval', { interval: 200 })
    await dt('Profiler.start')
    active.current = true; setState('recording')
    if (reload) await window.izlix.reload(tabId)
  }
  const stop = async (): Promise<void> => {
    if (!tabId) return
    setState('analyzing')
    const r = await dt('Profiler.stop')
    await window.izlix.dtDisable(tabId, 'profile'); active.current = false
    setResult(r?.profile ? analyzeProfile(r.profile as CpuProfile) : null)
    setState('idle')
  }
  const rows = useMemo(() => result?.rows.slice(0, 80) ?? [], [result])
  const maxSelf = rows[0]?.self ?? 1

  return (
    <div className="cov prof">
      <div className="net-bar">
        <span style={{ color: 'var(--dim)' }}>{state === 'recording' ? t('prof.recording', { s: secs }) : t('prof.hint')}</span>
        <span style={{ flex: 1 }} />
        {state === 'recording'
          ? <button className="btn primary" onClick={() => void stop()}>{t('prof.stop')}</button>
          : <><button className="btn" disabled={state === 'analyzing'} onClick={() => void start(false)}>{t('prof.record')}</button><button className="btn primary" disabled={state === 'analyzing'} onClick={() => void start(true)}>{t('prof.reloadRecord')}</button></>}
      </div>
      {state === 'analyzing' && <div className="skeleton" style={{ height: 60, margin: 12 }} />}
      {result && result.flame && result.totalMs > 0 && (
        <div className="cov-body">
          <div className="net-stats">
            <div className="stat"><span>{t('prof.total')}</span><b><CountUp value={Math.round(result.totalMs)} /> ms</b></div>
            <div className="stat"><span>{t('prof.idle')}</span><b>{fmt(result.idleMs)}</b></div>
            <div className="stat"><span>{t('prof.fns')}</span><b>{result.rows.length}</b></div>
          </div>
          <h4 className="sec">{t('prof.flame')}</h4>
          <div style={{ padding: '0 12px' }}><Flame root={result.flame} totalMs={result.totalMs} maxDepth={result.maxDepth} /></div>
          <h4 className="sec">{t('prof.fns')}</h4>
          <div className="covlist">
            <div className="covrow profhead"><span>{t('prof.fn')}</span><span /><code>{t('prof.self')}</code><code>{t('prof.totalCol')}</code></div>
            {rows.map((r) => (
              <div key={r.key} className="covrow profrow" onClick={() => openAt(r.url, r.line)} style={{ cursor: /^https?:/.test(r.url) ? 'pointer' : 'default' }}>
                <span className="u" title={`${r.url}:${r.line}`}>{r.name}<em>{shortUrl(r.url)}{r.url ? `:${r.line}` : ''}</em></span>
                <div className="covbar prof-bar"><b style={{ width: `${(r.self / maxSelf) * 100}%` }} /></div>
                <code>{fmt(r.self)}</code><code>{fmt(r.total)}</code>
              </div>
            ))}
          </div>
        </div>
      )}
      {result && (!result.flame || result.totalMs <= 0) && <div className="empty-hint">{t('prof.none')}</div>}
      {!result && state === 'idle' && <div className="empty-hint">{t('prof.empty')}</div>}
    </div>
  )
}
