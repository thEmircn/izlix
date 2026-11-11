import { useEffect, useMemo, useState } from 'react'
import { originKey } from '../shared/favicon'
import { useStore, useT, toast } from './store'
import { Kbd } from './ui'

interface V { url: string; title: string; ts: number }
const dayKey = (ts: number): string => new Date(ts).toDateString()
const hostOf = (u: string): string => { try { return new URL(u).host } catch { return u } }

/** Gecmis (⌘Y): tarihe gore gruplu, aranabilir, tek tek silinebilir; "tarama verilerini temizle" paneli. */
export function HistoryPage({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const favicons = useStore((s) => s.favicons), tabId = useStore((s) => s.activeTabId), lang = useStore((s) => s.settings.language)
  const [q, setQ] = useState('')
  const [rows, setRows] = useState<V[]>([])
  const [clearing, setClearing] = useState(false)
  const [range, setRange] = useState<'hour' | 'day' | 'week' | 'all'>('day')
  const [opt, setOpt] = useState({ history: true, cookies: false, cache: false })
  const load = (): void => { void api.visits(q, 1500).then((l: V[]) => setRows(l ?? [])) }
  useEffect(() => { const h = setTimeout(load, 120); return () => clearTimeout(h) }, [q])
  const groups = useMemo(() => {
    const out: { day: string; ts: number; items: V[] }[] = []
    for (const v of rows) { const k = dayKey(v.ts); const g = out[out.length - 1]; if (g && g.day === k) g.items.push(v); else out.push({ day: k, ts: v.ts, items: [v] }) }
    return out
  }, [rows])
  const dayLabel = (ts: number): string => {
    const d = new Date(ts), today = new Date(), y = new Date(Date.now() - 86_400_000)
    return d.toDateString() === today.toDateString() ? t('hist.today') : d.toDateString() === y.toDateString() ? t('hist.yesterday') : d.toLocaleDateString(lang === 'tr' ? 'tr-TR' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  }
  const open = (url: string): void => { if (tabId) void api.go(tabId, url); else void api.createTab(url); onClose() }
  const doClear = (): void => { void api.clearData({ range, ...opt }).then((r: { history: number }) => { toast(t('hist.cleared', { n: r.history })); setClearing(false); load() }) }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog hist" role="dialog" aria-label={t('menu.history')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head">
          <b>{t('menu.history')}</b>
          <input autoFocus value={q} spellCheck={false} placeholder={t('hist.search')} onChange={(e) => setQ(e.target.value)} />
          <button className="btn" onClick={() => setClearing((v) => !v)}>{t('hist.clearBtn')}</button><Kbd>⌘Y</Kbd>
        </div>
        {clearing && (
          <div className="hist-clear">
            <div className="hrow"><span>{t('hist.range')}</span>
              <select value={range} onChange={(e) => setRange(e.target.value as typeof range)}><option value="hour">{t('hist.r.hour')}</option><option value="day">{t('hist.r.day')}</option><option value="week">{t('hist.r.week')}</option><option value="all">{t('hist.r.all')}</option></select></div>
            <label><input type="checkbox" checked={opt.history} onChange={(e) => setOpt({ ...opt, history: e.target.checked })} />{t('hist.o.history')}</label>
            <label><input type="checkbox" checked={opt.cookies} onChange={(e) => setOpt({ ...opt, cookies: e.target.checked })} />{t('hist.o.cookies')}</label>
            <label><input type="checkbox" checked={opt.cache} onChange={(e) => setOpt({ ...opt, cache: e.target.checked })} />{t('hist.o.cache')}</label>
            {opt.cookies && range !== 'all' && <div className="shint">{t('hist.cookieNote')}</div>}
            <div style={{ display: 'flex', gap: 8, marginTop: 8 }}><button className="btn primary" disabled={!opt.history && !opt.cookies && !opt.cache} onClick={doClear}>{t('hist.clearNow')}</button><button className="btn" onClick={() => setClearing(false)}>{t('dlg.cancel')}</button></div>
          </div>
        )}
        <div className="hist-body">
          {groups.length === 0 && <div className="hub-empty">{t('hist.empty')}</div>}
          {groups.map((g) => (
            <section key={g.day}>
              <h4>{dayLabel(g.ts)}</h4>
              {g.items.map((v) => (
                <div className="hist-row" key={v.url + v.ts} onClick={() => open(v.url)} title={v.url}>
                  <code>{new Date(v.ts).toLocaleTimeString(lang === 'tr' ? 'tr-TR' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</code>
                  <span className="hist-ic">{favicons[originKey(v.url) ?? ''] ? <img alt="" src={favicons[originKey(v.url) ?? '']} /> : <i />}</span>
                  <span className="hist-t"><b>{v.title || v.url}</b><small>{hostOf(v.url)}</small></span>
                  <button className="hist-x" aria-label={t('hist.del')} title={t('hist.del')} onClick={(e) => { e.stopPropagation(); void api.deleteVisit(v.url, v.ts).then(load) }}>×</button>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
