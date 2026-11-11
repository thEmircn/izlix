import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore, useT, wsName } from './store'
import { originKey } from '../shared/favicon'
import { Fav, Roll } from './ui'
import { SuggestList, useSuggestions } from './Suggest'
import type { Sug } from '../shared/suggest'
import { IcBookmark, IcClock, IcFolder, IcGear, IcHome, IcLayers, IcServer, Plus } from './icons'

type Section = 'home' | 'servers' | 'bookmarks' | 'history' | 'sessions'
interface Hist { url: string; title: string; ts: number }
const hue = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }
const hostOf = (u: string): string => { try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : `http://${u}`).host || u } catch { return u } }
const rel = (ts: number): string => { const m = Math.round((Date.now() - ts) / 60000); return m < 1 ? '<1 dk' : m < 60 ? `${m} dk` : m < 1440 ? `${Math.round(m / 60)} sa` : `${Math.round(m / 1440)} g` }

/** Yeni sekme / ana ekran: sol kenar cubugu (calisma alanlari + bolumler) ve sagda icerik. Uygulama gibi iki panelli yerlesim; arama yalnizca kucuk bir suzgec/adres kutusu. */
export function StartPage({ style, tabId }: { style: React.CSSProperties; tabId: string | null }) {
  const t = useT()
  const s = useStore()
  const api = window.izlix
  const [sec, setSec] = useState<Section>('home')
  const [q, setQ] = useState('')
  const [hist, setHist] = useState<Hist[]>([])
  const filter = useRef<HTMLInputElement>(null)
  const formRef = useRef<HTMLFormElement>(null)
  const [focused, setFocused] = useState(false)
  const sg = useSuggestions(q, true)
  const pickSug = (x: Sug): void => { setFocused(false); if (x.kind === 'tab' && x.tabId) void api.activateTab(x.tabId); else go(x.url) }
  const [pop, setPop] = useState<{ url: string; x: number; y: number; img: string | null | undefined } | null>(null)
  const thumbs = useRef(new Map<string, string | null>())
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const hover = (url: string) => ({
    onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
      const r = e.currentTarget.getBoundingClientRect(); clearTimeout(hoverTimer.current)
      hoverTimer.current = setTimeout(() => {
        const known = thumbs.current.get(url)
        setPop({ url, x: r.right, y: r.top + r.height / 2, img: known })
        if (known === undefined) void api.thumb(url).then((d) => { thumbs.current.set(url, d); setPop((p) => (p && p.url === url ? { ...p, img: d } : p)) }).catch(() => {})
      }, 350)
    },
    onMouseLeave: () => { clearTimeout(hoverTimer.current); setPop(null) }
  })
  useEffect(() => () => clearTimeout(hoverTimer.current), [])
  useEffect(() => { void api.history().then((l: Hist[]) => setHist(l ?? [])).catch(() => {}) }, [])
  useEffect(() => { const h = setTimeout(() => filter.current?.focus(), 80); return () => clearTimeout(h) }, [tabId, sec])

  useEffect(() => { const o = s.detected.map((d) => `http://localhost:${d.port}`); if (o.length) void api.favicons(o).then((f) => useStore.setState((st) => ({ favicons: { ...st.favicons, ...f } }))).catch(() => {}) }, [s.detected.map((d) => d.port).join(',')])
  const iconOf = (url: string): string | undefined => s.favicons[originKey(url) ?? '']
  const marks = s.bookmarks[s.activeWorkspaceId] ?? []
  const sess = s.sessions[s.activeWorkspaceId] ?? []
  const servers = s.detected
  const go = (url: string): void => { const v = url.trim(); if (!v) return; if (tabId) void api.go(tabId, v); else void api.createTab(v) }
  const looksLikeUrl = (v: string): boolean => /^(https?:\/\/|localhost|[\w-]+(\.[\w-]+)+(\/|:|$)|\d{1,3}(\.\d{1,3}){3})/i.test(v.trim())
  const ql = q.trim().toLowerCase()
  const m = (...x: string[]): boolean => !ql || x.some((y) => y.toLowerCase().includes(ql))
  const fServers = useMemo(() => servers.filter((d) => m(String(d.port), d.framework ?? '', d.cwd ?? '')), [servers, ql])
  const fMarks = useMemo(() => marks.filter((b) => m(b.title, b.url)), [marks, ql])
  const fHist = useMemo(() => hist.filter((h) => m(h.title, h.url)).slice(0, 60), [hist, ql])
  const fSess = useMemo(() => sess.filter((x) => m(x.name)), [sess, ql])

  const nav: { id: Section; label: string; icon: React.ReactElement; n: number }[] = [
    { id: 'home', label: t('hub.home'), icon: <IcHome />, n: 0 },
    { id: 'servers', label: t('hub.servers'), icon: <IcServer />, n: servers.length },
    { id: 'bookmarks', label: t('hub.bookmarks'), icon: <IcBookmark />, n: marks.length },
    { id: 'history', label: t('hub.history'), icon: <IcClock />, n: hist.length },
    { id: 'sessions', label: t('hub.sessions'), icon: <IcLayers />, n: sess.length }
  ]
  const title = nav.find((x) => x.id === sec)!.label

  const serverRow = (d: (typeof servers)[number]): React.ReactElement => (
    <button key={d.port} className="hub-row" onClick={() => go(`localhost:${d.port}`)} title={d.cwd ?? ''} {...hover(`http://localhost:${d.port}/`)}>
      <span className={`hub-av srv ${iconOf(`http://localhost:${d.port}`) ? 'has-icon' : ''}`} style={{ ['--h' as any]: hue(String(d.port)) }}><Fav icon={iconOf(`http://localhost:${d.port}`)}>{(d.cwd?.split('/').filter(Boolean).pop() ?? 'S').charAt(0).toUpperCase()}</Fav><i className="dot" /></span>
      <span className="hub-main"><b>{d.cwd?.split('/').filter(Boolean).pop() ?? t('start.devServer')}</b><small>{d.cwd ?? `localhost:${d.port}`}</small></span>
      <code>:{d.port}</code>{d.framework && <em className="hub-tag">{d.framework}</em>}<span className="hub-go">{t('hub.open')}</span>
    </button>
  )
  const urlRow = (url: string, ti: string, meta?: string): React.ReactElement => (
    <button key={url} className="hub-row" onClick={() => go(url)} title={url} {...hover(url)}>
      <span className={`hub-av ${iconOf(url) ? 'has-icon' : ''}`} style={{ ['--h' as any]: hue(hostOf(url)) }}><Fav icon={iconOf(url)}>{(ti || hostOf(url)).trim().charAt(0).toUpperCase()}</Fav></span>
      <span className="hub-main"><b>{ti || hostOf(url)}</b><small>{hostOf(url)}</small></span>{meta && <code>{meta}</code>}<span className="hub-go">{t('hub.open')}</span>
    </button>
  )
  const sessRow = (x: (typeof sess)[number]): React.ReactElement => (
    <div key={x.id} className="hub-row static">
      <span className="hub-av ses"><IcLayers /></span>
      <span className="hub-main"><b>{x.name}</b><small>{t('sess.tabs', { n: x.tabs.length })} · {new Date(x.ts).toLocaleDateString()}</small></span>
      <button className="hub-act" onClick={() => void api.openSession(x.id)}>{t('sess.open')}</button>
      <button className="hub-act" onClick={() => void api.openSession(x.id, true)}>{t('hub.replace')}</button>
      <button className="hub-act bad" onClick={() => void api.deleteSession(x.id)}>{t('sess.del')}</button>
    </div>
  )
  const block = (id: Section, label: string, n: number, children: React.ReactNode): React.ReactElement | null => (n === 0 ? null : (
    <section key={id} className="hub-block"><header><h4>{label}</h4><button className="link" onClick={() => setSec(id)}>{t('hub.all')} ({n}) ›</button></header>{children}</section>
  ))

  return (
    <div className="start hub" style={style}>
      <aside className="hub-side">
        <div className="hub-brand"><span className="hub-logo" /><b>Izlix</b></div>
        <button className="hub-new" onClick={() => api.createTab()}><Plus />{t('tab.new')}<kbd className="kbd">⌘T</kbd></button>
        <div className="hub-priv">
          <button onClick={() => api.createTab(undefined, 'incognito')} title="⇧⌘N"><span className="priv-dot" />{t('hub.private')}</button>
          <button className="tor" onClick={() => api.createTab(undefined, 'tor')} title="⌥⇧⌘N"><span className="priv-dot" />{t('hub.tor')}</button>
        </div>
        <nav className="hub-nav">
          {nav.map((x) => <button key={x.id} className={x.id === sec ? 'on' : ''} onClick={() => { setSec(x.id); setQ('') }}>{x.icon}<span>{x.label}</span>{x.n > 0 && <em><Roll text={x.n} /></em>}</button>)}
        </nav>
        <div className="hub-cap">{t('hub.workspaces')}</div>
        <div className="hub-ws">
          {s.workspaces.map((w) => <button key={w.id} className={w.id === s.activeWorkspaceId ? 'on' : ''} onClick={() => void api.switchWorkspace(w.id)} title={w.rootDir ?? ''}><span style={{ ['--h' as any]: hue(w.id) }}>{wsName(w).charAt(0).toUpperCase()}</span>{wsName(w)}</button>)}
          <button className="ghost" onClick={() => void api.createWorkspace('', null)}><IcFolder />{t('ws.fromFolder')}</button>
        </div>
        <div className="hub-foot">
          <button onClick={() => s.set({ overlay: 'palette' })}><kbd className="kbd">⌘K</kbd>{t('home.palette')}</button>
          <button onClick={() => s.set({ overlay: 'settings' })}><IcGear />{t('hub.settings')}</button>
        </div>
      </aside>
      <section className="hub-content">
        <header className="hub-head">
          <h2 key={sec}>{title}</h2>
          <form ref={formRef} className="hub-filter" onSubmit={(e) => { e.preventDefault(); if (looksLikeUrl(q)) go(q); else if (sec === 'home' || !ql) go(q) }}>
            <input ref={filter} value={q} spellCheck={false} autoComplete="off" placeholder={t('hub.filterPh')} onChange={(e) => { setQ(e.target.value); setFocused(true) }} onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              onKeyDown={(e) => {
                if (!focused || sg.items.length < 2) return
                if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const n = sg.items.length; sg.setIdx((i) => (i + (e.key === 'ArrowDown' ? 1 : n - 1)) % n) }
                else if (e.key === 'Enter' && sg.idx > 0) { e.preventDefault(); pickSug(sg.items[sg.idx]) }
                else if (e.key === 'Escape') setFocused(false)
              }} />
            {looksLikeUrl(q) && <button type="submit" className="hub-act">{t('hub.go')} ↵</button>}
          </form>
        </header>
        <div className="hub-body" key={sec}>
          {sec === 'home' && (
            <>
              {servers.length === 0 && marks.length === 0 && hist.length === 0 && sess.length === 0 && <div className="hub-empty">{t('start.empty')}</div>}
              {block('servers', t('hub.servers'), fServers.length, <>{fServers.slice(0, 4).map((d) => serverRow(d))}</>)}
              {block('sessions', t('hub.continue'), fSess.length, <>{fSess.slice(0, 3).map((x) => sessRow(x))}</>)}
              {block('bookmarks', t('hub.bookmarks'), fMarks.length, <>{fMarks.slice(0, 4).map((b) => urlRow(b.url, b.title))}</>)}
              {block('history', t('hub.recent'), fHist.length, <>{fHist.slice(0, 5).map((h) => urlRow(h.url, h.title, rel(h.ts)))}</>)}
            </>
          )}
          {sec === 'servers' && (fServers.length ? fServers.map((d) => serverRow(d)) : <div className="hub-empty">{t('home.noServers')}</div>)}
          {sec === 'bookmarks' && (fMarks.length ? fMarks.map((b) => urlRow(b.url, b.title)) : <div className="hub-empty">{t('home.noBookmarks')}</div>)}
          {sec === 'history' && (fHist.length ? fHist.map((h) => urlRow(h.url, h.title, rel(h.ts))) : <div className="hub-empty">{t('home.noRecent')}</div>)}
          {sec === 'sessions' && (<>
            <div className="hub-tools"><button className="btn" onClick={() => s.set({ overlay: 'session' })}>{t('sess.save')}</button></div>
            {fSess.length ? fSess.map((x) => sessRow(x)) : <div className="hub-empty">{t('sess.empty')}</div>}
          </>)}
        </div>
      </section>
      {focused && <SuggestList items={sg.items} idx={sg.idx} anchor={formRef.current} query={q} onPick={pickSug} onHover={sg.setIdx} />}
      {pop && (
        <div className="hub-pop" style={{ left: Math.min(pop.x + 12, window.innerWidth - 392), top: Math.max(12, Math.min(pop.y - 110, window.innerHeight - 250)) }}>
          {pop.img ? <img alt="" src={pop.img} /> : <div className={`hub-pop-empty ${pop.img === undefined ? 'load' : ''}`}>{pop.img === undefined ? '' : t('hub.noPreview')}</div>}
          <div className="hub-pop-url">{hostOf(pop.url)}</div>
        </div>
      )}
    </div>
  )
}
