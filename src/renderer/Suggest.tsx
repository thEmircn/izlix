import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { engineById } from '../shared/search'
import { originKey } from '../shared/favicon'
import { inlineCompletion, suggest, type Sug } from '../shared/suggest'
import { useStore, useT } from './store'
import { IcArrow, IcBookmark, IcClock, IcLayers, IcSearch, IcServer } from './icons'

const hostOf = (u: string): string => { try { return new URL(/^[a-z]+:\/\//i.test(u) ? u : `http://${u}`).host || u } catch { return u } }
const GLYPH: Record<Sug['kind'], React.ReactElement> = { search: <IcSearch />, url: <IcArrow />, tab: <IcLayers />, bookmark: <IcBookmark />, server: <IcServer />, history: <IcClock /> }

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
  const items = useMemo(() => (enabled ? suggest(query, src) : []), [query, src, enabled])
  const complete = (q: string): string | null => inlineCompletion(q, [...src.tabs.map((x) => x.url), ...src.bookmarks.map((x) => x.url), ...src.servers.map((x) => `http://localhost:${x.port}`), ...src.history.map((x) => x.url)])
  const [idx, setIdx] = useState(0)
  useEffect(() => setIdx(0), [query])
  return { items, idx, setIdx, complete }
}

/** Ok tuslariyla secilebilen oneri listesi; `anchor` girdi kutusunun altina sabitlenir (native sayfa gorunumu gizlendigi icin kabugun ustunde gorunur). */
export function SuggestList({ items, idx, anchor, onPick, onHover, query }: { items: Sug[]; idx: number; anchor: HTMLElement | null; onPick: (s: Sug) => void; onHover: (i: number) => void; query: string }) {
  const t = useT()
  const favicons = useStore((s) => s.favicons), engine = useStore((s) => s.settings.searchEngine)
  if (!anchor || items.length < 2) return null // yalnizca "yazdigin" satiri varsa liste acilmaz
  const r = anchor.getBoundingClientRect()
  return createPortal(
    <div className="sug" role="listbox" style={{ left: r.left, top: r.bottom + 6, width: Math.max(r.width, 360) }} onMouseDown={(e) => e.preventDefault()}>
      {items.map((x, i) => {
        const ic = favicons[originKey(x.url) ?? '']
        return (
          <div key={`${x.kind}:${x.url}`} role="option" aria-selected={i === idx} className={`sug-row ${i === idx ? 'on' : ''}`} onMouseEnter={() => onHover(i)} onClick={() => onPick(x)}>
            <span className="sug-ic">{ic && x.kind !== 'search' && x.kind !== 'url' ? <img alt="" src={ic} /> : GLYPH[x.kind]}</span>
            <span className="sug-main">
              {x.kind === 'search' ? <b>{t('sug.search', { q: query.trim(), engine: engineById(engine).label })}</b>
                : x.kind === 'url' ? <b>{t('sug.go', { q: query.trim() })}</b>
                  : <><b>{x.title}</b><small>{hostOf(x.url)}{x.url.replace(/^https?:\/\/[^/]+/, '').length > 1 ? x.url.replace(/^https?:\/\/[^/]+/, '').slice(0, 40) : ''}</small></>}
            </span>
            {x.kind !== 'search' && x.kind !== 'url' && <em className="sug-tag">{t(`sug.${x.kind}` as any)}</em>}
          </div>
        )
      })}
    </div>, document.body
  )
}
