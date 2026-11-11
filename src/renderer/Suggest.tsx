import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { engineById } from '../shared/search'
import { originKey } from '../shared/favicon'
import { mergeShortcuts } from '../shared/shortcuts'
import { inlineCompletion, looksLikeUrl, suggest, type Sug } from '../shared/suggest'
import { POPULAR } from '../shared/popular'
import { useStore, useT } from './store'
import { IcGlobe, IcArrow, IcBookmark, IcClock, IcLayers, IcSearch, IcServer } from './icons'

const hostOf = (u: string): string => { try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : `http://${u}`).host || u } catch { return u } }
const GLYPH: Record<Sug['kind'], React.ReactElement> = { shortcut: <IcSearch />, site: <IcGlobe />, search: <IcSearch />, url: <IcArrow />, tab: <IcLayers />, bookmark: <IcBookmark />, server: <IcServer />, history: <IcClock /> }

/** Oneri verisi: yazilan metne gore yerel kaynaklardan (sekme, yer imi, dev sunucusu, gecmis) siralanmis liste + satir ici tamamlama adaylari. */
export function useSuggestions(query: string, enabled: boolean) {
  const tabs = useStore((s) => s.tabs), ws = useStore((s) => s.activeWorkspaceId), marks = useStore((s) => s.bookmarks[s.activeWorkspaceId]), detected = useStore((s) => s.detected)
  const [hist, setHist] = useState<{ url: string; title: string; ts: number }[]>([])
  useEffect(() => { if (enabled) void window.izlix.history().then((l: typeof hist) => setHist(l ?? [])).catch(() => {}) }, [enabled])
  const src = useMemo(() => ({
    history: hist, bookmarks: marks ?? [],
    servers: detected.map((d) => ({ port: d.port, name: d.cwd?.split('/').filter(Boolean).pop() ?? '' })),
    tabs: tabs.filter((t) => t.workspaceId === ws && !t.private && t.url).map((t) => ({ id: t.id, url: t.url, title: t.title }))
  }), [hist, marks, detected, tabs, ws])
  const userShortcuts = useStore((s) => s.settings.shortcuts)
  const merged = useMemo(() => mergeShortcuts(userShortcuts), [userShortcuts])
  const local = useMemo(() => (enabled ? suggest(query, src, 8, Date.now(), merged) : []), [query, src, enabled, merged])
  // arama motorundan canli oneriler: 140 ms bekleyerek; gizli/Tor sekmede ve ayar kapaliyken gonderilmez
  const allow = useStore((s) => s.settings.searchSuggest !== false && !s.tabs.find((t) => t.id === s.activeTabId)?.private)
  const [remote, setRemote] = useState<{ q: string; list: string[] }>({ q: '', list: [] })
  useEffect(() => {
    const q = query.trim()
    if (!enabled || !allow || q.length < 2 || q.length > 100 || looksLikeUrl(q)) { setRemote({ q: '', list: [] }); return }
    let dead = false
    const h = setTimeout(() => { void window.izlix.suggestRemote(q).then((l: string[]) => { if (!dead) setRemote({ q, list: l }) }).catch(() => {}) }, 140)
    return () => { dead = true; clearTimeout(h) }
  }, [query, enabled, allow])
  const items = useMemo(() => {
    if (!local.length) return local
    const seen = new Set(local.map((x) => x.url.toLowerCase()))
    const extra: Sug[] = remote.q === query.trim() ? remote.list.filter((x) => !seen.has(x.toLowerCase())).slice(0, 5).map((x) => ({ kind: 'search' as const, title: x, url: x })) : []
    return [...local, ...extra]
  }, [local, remote, query])
  const complete = (q: string): string | null => inlineCompletion(q, [...src.tabs.map((x) => x.url), ...src.bookmarks.map((x) => x.url), ...src.servers.map((x) => `http://localhost:${x.port}`), ...src.history.map((x) => x.url), ...POPULAR.map((x) => `https://${x.host}`)])
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [query])
  return { items, idx, setIdx, complete }
}

/** Ok tuslariyla secilebilen oneri listesi; `anchor` girdi kutusunun altina sabitlenir (native sayfa gorunumu gizlendigi icin kabugun ustunde gorunur). */
export function SuggestList({ items, idx, anchor, onPick, onHover, query }: { items: Sug[]; idx: number; anchor: HTMLElement | null; onPick: (s: Sug) => void; onHover: (i: number) => void; query: string }) {
  const t = useT()
  const favicons = useStore((s) => s.favicons), engine = useStore((s) => s.settings.searchEngine)
  if (!anchor || (items.length < 2 && items[0]?.kind !== 'shortcut')) return null // yalnizca "yazdigin" satiri varsa liste acilmaz
  const r = anchor.getBoundingClientRect()
  return createPortal(
    <div className="sug" role="listbox" style={{ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 360) }} onMouseDown={(e) => e.preventDefault()}>
      {items.map((x, i) => {
        const ic = favicons[originKey(x.url) ?? '']
        return (
          <div key={`${x.kind}:${x.url}`} role="option" aria-selected={i === idx} className={`sug-row ${i === idx ? 'on' : ''}`} onMouseEnter={() => onHover(i)} onClick={() => onPick(x)}>
            <span className="sug-ic">{ic && x.kind !== 'search' && x.kind !== 'url' && x.kind !== 'shortcut' ? <img alt="" src={ic} /> : GLYPH[x.kind]}</span>
            <span className="sug-main">
              {x.kind === 'search' && i > 0 ? <b>{x.title}</b>
                : x.kind === 'search' ? <b>{t('sug.search', { q: query.trim(), engine: engineById(engine).label })}</b>
                : x.kind === 'shortcut' ? <b>{x.title}</b>
                : x.kind === 'url' ? <b>{t('sug.go', { q: query.trim() })}</b>
                  : <><b>{x.title}</b><small>{hostOf(x.url)}{x.url.replace(/^https?:\/\/[^/]+/, '').length > 1 ? x.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 40) : ''}</small></>}
            </span>
            {x.kind !== 'search' && x.kind !== 'url' && x.kind !== 'shortcut' && <em className="sug-tag">{t(`sug.${x.kind}` as any)}</em>}
          </div>
        )
      })}
    </div>, document.body
  )
}
