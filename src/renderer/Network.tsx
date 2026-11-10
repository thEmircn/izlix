import { useEffect, useMemo, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { SENSITIVE_KEYS } from '../shared/mask'
import { toCurl, toFetch, buildNetworkRows, formatBytes, formatMs, statusClass, type NetRow, type NetType } from '../shared/network'
import { Chain, QuickRules } from './Timeline'
import { Close } from './icons'
import { Seg } from './ui'
import { JwtList } from './Jwt'
import { findJwts } from '../shared/jwt'
import { toast, useStore, useT, writePref } from './store'

const FILTERS: ('all' | NetType)[] = ['all', 'xhr', 'ws', 'js', 'css', 'img', 'doc', 'font', 'other']

/** Network paneli: canli akan satirlar, waterfall ve aşagidan acilan ayrinti cekmecesi. */
export function Network({ events, byId }: { events: BusEvent[]; byId: Map<number, BusEvent> }) {
  const t = useT()
  const [filter, setFilter] = useState<'all' | NetType>('all')
  const [q, setQ] = useState('')
  const [clearedAt, setClearedAt] = useState(0)
  const selectedId = useStore((s) => s.selectedEventId)
  const tabId = useStore((s) => s.activeTabId)
  const preserve = useStore((s) => s.preserveLog)
  const noCache = useStore((s) => !!s.tabs.find((x) => x.id === s.activeTabId)?.noCache)
  const set = useStore((s) => s.set)
  const [now, setNow] = useState(Date.now())

  const all = useMemo(() => buildNetworkRows(events.filter((e) => e.ts >= clearedAt)), [events, clearedAt])
  const counts = useMemo(() => { const c: Record<string, number> = { all: all.length }; for (const r of all) c[r.type] = (c[r.type] ?? 0) + 1; return c }, [all])
  const rows = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return all.filter((r) => (filter === 'all' || r.type === filter) && (!needle || r.url.toLowerCase().includes(needle) || String(r.status ?? '').includes(needle) || r.method.toLowerCase() === needle))
  }, [all, filter, q])
  const pending = rows.some((r) => r.end == null && !r.failed)
  useEffect(() => { if (!pending) return; const h = setInterval(() => setNow(Date.now()), 120); return () => clearInterval(h) }, [pending])

  const t0 = rows.length ? Math.min(...rows.map((r) => r.start)) : 0
  const tEnd = rows.length ? Math.max(...rows.map((r) => r.end ?? now)) : 1
  const span = Math.max(400, tEnd - t0)
  const totalSize = rows.reduce((a, r) => a + (r.size ?? 0), 0)
  const errors = rows.filter((r) => r.failed || (r.status ?? 0) >= 400).length
  const sel = rows.find((r) => r.id === selectedId) ?? null

  return (
    <div className="net">
      <div className="net-bar">
        <div className="chips">
          {FILTERS.map((f) => (counts[f] || f === 'all') ? (
            <button key={f} className={`fchip ${filter === f ? 'on' : ''}`} onClick={() => setFilter(f)}>{f === 'all' ? t('net.all') : f}<em>{counts[f] ?? 0}</em></button>
          ) : null)}
        </div>
        <input className="search" placeholder={t('net.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <label className="tgl"><input type="checkbox" checked={preserve} onChange={(e) => { writePref('preserveLog', e.target.checked ? '1' : '0'); useStore.getState().set({ preserveLog: e.target.checked }) }} />{t('net.preserve')}</label>
        <label className="tgl"><input type="checkbox" checked={noCache} onChange={(e) => tabId && void window.izlix.setCacheDisabled(tabId, e.target.checked)} />{t('net.noCache')}</label>
        <button className="btn" onClick={() => tabId && void window.izlix.saveHar(tabId).then((p: string | null) => p && toast(t('toast.har', { p: p.split('/').pop() ?? '' })))}>HAR</button>
        <button className="btn" onClick={() => { setClearedAt(Date.now()); set({ selectedEventId: null }) }}>{t('net.clear')}</button>
      </div>
      <div className="net-stats">
        <Stat label={t('net.requests')} value={rows.length} />
        <Stat label={t('net.transferred')} text={formatBytes(totalSize) || '0 B'} />
        <Stat label={t('net.finish')} text={formatMs(Math.round(span))} />
        <Stat label={t('net.errors')} value={errors} bad={errors > 0} />
      </div>
      <div className="net-head"><span>{t('net.method')}</span><span>{t('net.name')}</span><span>{t('net.status')}</span><span>{t('net.size')}</span><span>{t('net.time')}</span><span>{t('net.waterfall')}</span></div>
      <div className="net-list">
        {rows.map((r) => <Row key={r.id} r={r} t0={t0} span={span} now={now} selected={r.id === selectedId} onClick={() => set({ selectedEventId: r.id === selectedId ? null : r.id })} />)}
        {!rows.length && <div className="empty-hint">{t('net.empty')}</div>}
      </div>
      {sel && <Drawer key={sel.id} r={sel} byId={byId} onClose={() => set({ selectedEventId: null })} />}
    </div>
  )
}

/** Sayi/metin degisince yumusakca zipliyor */
function Stat({ label, value, text, bad }: { label: string; value?: number; text?: string; bad?: boolean }) {
  const shown = text ?? String(value ?? 0)
  return <div className="stat"><span>{label}</span><b key={shown} className={bad ? 'bad' : ''}>{shown}</b></div>
}

function Row({ r, t0, span, now, selected, onClick }: { r: NetRow; t0: number; span: number; now: number; selected: boolean; onClick(): void }) {
  const cls = statusClass(r)
  const left = ((r.start - t0) / span) * 100
  const end = r.end ?? now
  const width = Math.max(0.6, ((end - r.start) / span) * 100)
  const dur = r.durationMs ?? (r.end == null && !r.failed ? Math.round(now - r.start) : null)
  return (
    <div className={`net-row ${selected ? 'sel' : ''} ${cls}`} onClick={onClick}>
      <span className={`m m-${r.method}`}>{r.method}</span>
      <span className="name" title={r.url}>{r.name}<i>{r.host}</i>{r.modified && <u className="mod">modified</u>}</span>
      <span className={`pill ${cls}`}>{r.failed ? 'failed' : r.type === 'ws' && r.closed ? 'closed' : r.status ?? '···'}</span>
      <span className="num">{r.type === 'ws' ? `${r.frames} msg` : r.fromCache ? 'cache' : formatBytes(r.size)}</span>
      <span className="num">{dur != null ? formatMs(dur) : ''}</span>
      <span className="wf"><b className={`${cls} ${r.modified ? 'mod' : ''} ${r.end == null && !r.failed ? 'live' : ''}`} style={{ left: `${left}%`, width: `${Math.min(width, 100 - left)}%` }} /></span>
    </div>
  )
}

type DTab = 'headers' | 'payload' | 'response' | 'timing' | 'cause' | 'messages'
function Drawer({ r, byId, onClose }: { r: NetRow; byId: Map<number, BusEvent>; onClose(): void }) {
  const t = useT()
  const isWs = r.type === 'ws'
  const [tab, setTab] = useState<DTab>(isWs ? 'messages' : 'headers')
  const req = byId.get(r.id), res = r.resId != null ? byId.get(r.resId) : undefined
  return (
    <div className="drawer">
      <div className="drawer-h">
        <span className={`m m-${r.method}`}>{r.method}</span><span className="url" title={r.url}>{r.url}</span>
        <span className={`pill ${statusClass(r)}`}>{r.failed ? 'failed' : r.status ?? '···'}</span>
        <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(toCurl(r.method, r.url, req?.payload.headers, req?.payload.postData)); toast(t('toast.copied')) }}>cURL</button>
        <button className="btn sm" onClick={() => { void navigator.clipboard?.writeText(toFetch(r.method, r.url, req?.payload.headers, req?.payload.postData)); toast(t('toast.copied')) }}>fetch</button>
        <button className="icon-btn" aria-label={t('rr.close')} onClick={onClose}><Close /></button>
      </div>
      <Seg<DTab> small value={tab} onChange={setTab} items={((isWs ? ['messages', 'headers', 'cause'] : ['headers', 'payload', 'response', 'timing', 'cause']) as DTab[]).map((k) => ({ key: k, label: t(`net.tab.${k}` as any) }))} />
      <div className="drawer-b" key={tab}>
        {tab === 'messages' && <Messages r={r} byId={byId} />}
        {tab === 'headers' && <Headers r={r} req={req} res={res} />}
        {tab === 'payload' && <Payload data={req?.payload.postData} empty={t('net.noPayload')} />}
        {tab === 'response' && <Body r={r} />}
        {tab === 'timing' && <Timing r={r} res={res} />}
        {tab === 'cause' && (req ? <><Chain ev={req} byId={byId} onSelect={(id) => useStore.getState().set({ selectedEventId: id })} /><QuickRules ev={req} byId={byId} /></> : null)}
      </div>
    </div>
  )
}

function KV({ title, data }: { title: string; data?: Record<string, string> }) {
  const [reveal, setReveal] = useState(false)
  const entries = Object.entries(data ?? {}).sort(([a], [b]) => a.localeCompare(b))
  if (!entries.length) return null
  const hasSecret = entries.some(([k]) => SENSITIVE_KEYS.test(k))
  return (
    <section className="kv">
      <h4>{title}{hasSecret && <button className="link" onClick={() => setReveal(!reveal)}>{reveal ? 'hide secrets' : 'show secrets'}</button>}</h4>
      {entries.map(([k, v]) => <div key={k}><span>{k}</span><code>{SENSITIVE_KEYS.test(k) && !reveal ? '••••••••' : v}</code></div>)}
    </section>
  )
}

function Headers({ r, req, res }: { r: NetRow; req?: BusEvent; res?: BusEvent }) {
  const t = useT()
  const general: Record<string, string> = { URL: r.url, Method: r.method, Status: r.failed ? r.failed : `${r.status ?? ''} ${res?.payload.statusText ?? ''}`.trim(), ...(res?.payload.remote ? { Remote: res.payload.remote } : {}), ...(res?.payload.protocol ? { Protocol: res.payload.protocol } : {}), ...(r.modified ? { Modified: 'by Request Rules' } : {}) }
  const jwts = useMemo(() => findJwts(JSON.stringify([req?.payload.headers, res?.payload.headers])), [req, res])
  return <><JwtList jwts={jwts} /><KV title={t('net.general')} data={general} /><KV title={t('net.resHeaders')} data={res?.payload.headers} /><KV title={t('net.reqHeaders')} data={req?.payload.headers} /></>
}

function Messages({ r, byId }: { r: NetRow; byId: Map<number, BusEvent> }) {
  const t = useT()
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const frames = useMemo(() => [...byId.values()].filter((e) => e.kind === 'ws' && e.payload.requestId === r.requestId).sort((a, b) => a.ts - b.ts), [byId, r.requestId])
  const shown = frames.filter((e) => !q || String(e.payload.data ?? '').toLowerCase().includes(q.toLowerCase()))
  const t0 = frames[0]?.ts ?? 0
  return (
    <div className="ws">
      <input className="search" style={{ width: '100%', marginBottom: 6 }} placeholder={t('ws.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
      {shown.map((e) => {
        const p = e.payload
        if (p.dir === 'closed') return <div key={e.id} className="ws-row sys">{t('ws.closed')}<code>+{Math.round(e.ts - t0)} ms</code></div>
        if (p.dir === 'error') return <div key={e.id} className="ws-row sys err">{p.data}</div>
        return (
          <div key={e.id} className={`ws-row ${p.dir}`} onClick={() => setOpen(open === e.id ? null : e.id)}>
            <i className="arrow">{p.dir === 'sent' ? '↑' : '↓'}</i>
            <span className="data">{String(p.data).slice(0, 160)}</span>
            <code>{formatBytes(p.size)}</code><code>+{Math.round(e.ts - t0)} ms</code>
            {open === e.id && <pre className="code" onClick={(x) => x.stopPropagation()}>{pretty(String(p.data))}</pre>}
          </div>
        )
      })}
      {!shown.length && <div className="empty-hint">{t('ws.empty')}</div>}
    </div>
  )
}

const pretty = (s: string): string => { try { return JSON.stringify(JSON.parse(s), null, 2) } catch { return s } }
function Payload({ data, empty }: { data?: string; empty: string }) {
  return data ? <pre className="code">{pretty(data)}</pre> : <div className="empty-hint">{empty}</div>
}

function Body({ r }: { r: NetRow }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [state, setState] = useState<{ loading: boolean; text: string | null }>({ loading: true, text: null })
  useEffect(() => {
    let live = true
    if (!tabId || r.resId == null) { setState({ loading: false, text: null }); return }
    void window.izlix.responseBody(tabId, r.requestId).then((text: string | null) => { if (live) setState({ loading: false, text }) })
    return () => { live = false }
  }, [tabId, r.requestId, r.resId])
  if (state.loading) return <div className="skel-wrap">{[90, 70, 82, 55].map((w, i) => <div key={i} className="skeleton" style={{ width: `${w}%`, height: 12, marginBottom: 8 }} />)}</div>
  if (state.text == null) return <div className="empty-hint">{t('net.noBody')}</div>
  return <><JwtList jwts={findJwts(state.text)} /><pre className="code">{pretty(state.text)}</pre></>
}

function Timing({ r, res }: { r: NetRow; res?: BusEvent }) {
  const tm = res?.payload.timing as Record<string, number> | undefined
  const seg: [string, number, string][] = []
  if (tm) {
    const d = (a: number, b: number): number => (a >= 0 && b >= 0 ? Math.max(0, b - a) : 0)
    seg.push(['DNS', d(tm.dnsStart, tm.dnsEnd), 'seg-a'], ['Connect', d(tm.connectStart, tm.connectEnd) - d(tm.sslStart, tm.sslEnd), 'seg-b'], ['TLS', d(tm.sslStart, tm.sslEnd), 'seg-c'],
      ['Send', d(tm.sendStart, tm.sendEnd), 'seg-d'], ['Waiting (TTFB)', d(tm.sendEnd, tm.receiveHeadersEnd), 'seg-e'])
    if (r.durationMs != null) seg.push(['Download', Math.max(0, r.durationMs - (tm.receiveHeadersEnd ?? 0)), 'seg-f'])
  }
  const total = seg.reduce((a, s) => a + s[1], 0) || 1
  return (
    <div className="timing">
      <div className="timing-total">{formatMs(r.durationMs)}</div>
      <div className="stack">{seg.map(([n, v, c]) => v > 0 && <i key={n} className={c} style={{ width: `${Math.max(1.5, (v / total) * 100)}%` }} title={`${n}: ${v.toFixed(1)} ms`} />)}</div>
      {seg.map(([n, v, c]) => <div key={n} className="trow"><i className={c} /><span>{n}</span><code>{v.toFixed(1)} ms</code></div>)}
      {!tm && <div className="empty-hint">no timing data (cached or intercepted)</div>}
    </div>
  )
}
