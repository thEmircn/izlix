import { useMemo, useState } from 'react'
import { originKey } from '../shared/favicon'
import { useStore, useT } from './store'
import { IcBookmark, IcFolder } from './icons'
import { Kbd } from './ui'

export const BM_H = 30
interface Bm { url: string; title: string; folder?: string }

const hostOf = (u: string): string => { try { return new URL(u).host } catch { return u } }

/** Yer imleri cubugu (⇧⌘B): kok yer imleri + klasorler (native acilir menu). */
export function BookmarkBar({ left }: { left: number }) {
  const t = useT()
  const api = window.izlix
  const list = useStore((s) => (s.bookmarks[s.activeWorkspaceId] ?? []) as Bm[]), favicons = useStore((s) => s.favicons), tabId = useStore((s) => s.activeTabId)
  const folders = useMemo(() => [...new Set(list.map((b) => b.folder).filter((f): f is string => !!f))], [list])
  const roots = list.filter((b) => !b.folder)
  const go = (url: string, newTab: boolean): void => { if (newTab || !tabId) void api.createTab(url); else void api.go(tabId, url) }
  return (
    <div className="bmbar" style={{ marginLeft: left, height: BM_H }}>
      {roots.length === 0 && folders.length === 0 && <span className="bmbar-empty">{t('bm.noBookmarks')}</span>}
      {roots.map((b) => (
        <button key={b.url} className="bmchip" title={`${b.title}\n${b.url}`} onClick={(e) => go(b.url, e.metaKey)} onAuxClick={(e) => { if (e.button === 1) go(b.url, true) }} onContextMenu={(e) => { e.preventDefault(); void api.bmMenu(null, b.url) }}>
          {favicons[originKey(b.url) ?? ''] ? <img alt="" src={favicons[originKey(b.url) ?? '']} /> : <IcBookmark />}<span>{b.title || hostOf(b.url)}</span>
        </button>
      ))}
      {folders.map((f) => <button key={f} className="bmchip folder" onClick={() => void api.bmMenu(f)}><IcFolder /><span>{f}</span><i>▾</i></button>)}
    </div>
  )
}

/** Yer imi yoneticisi (⌥⌘B): klasorler, duzenleme, tasima, silme. */
export function BookmarkManager({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const list = useStore((s) => (s.bookmarks[s.activeWorkspaceId] ?? []) as Bm[]), favicons = useStore((s) => s.favicons)
  const [sel, setSel] = useState<'all' | 'root' | string>('all')
  const [q, setQ] = useState('')
  const [extra, setExtra] = useState<string[]>([]) // henuz yer imi tasinmamis bos klasorler
  const [newName, setNewName] = useState<string | null>(null)
  const [renaming, setRenaming] = useState<{ from: string; to: string } | null>(null)
  const folders = useMemo(() => [...new Set([...list.map((b) => b.folder).filter((f): f is string => !!f), ...extra])].sort((a, b) => a.localeCompare(b)), [list, extra])
  const ql = q.trim().toLowerCase()
  const shown = list.filter((b) => (sel === 'all' || (sel === 'root' ? !b.folder : b.folder === sel)) && (!ql || b.title.toLowerCase().includes(ql) || b.url.toLowerCase().includes(ql)))
  const addFolder = (): void => { const n = (newName ?? '').trim(); if (n && !folders.includes(n)) { setExtra((x) => [...x, n]); setSel(n) } setNewName(null) }
  const rename = (): void => { if (renaming && renaming.to.trim() && renaming.to !== renaming.from) { void api.bmFolder(renaming.from, renaming.to.trim()); setExtra((x) => x.map((f) => (f === renaming.from ? renaming.to.trim() : f))); setSel(renaming.to.trim()) } setRenaming(null) }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog bm" role="dialog" aria-label={t('bm.title')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('bm.title')}</b><input value={q} spellCheck={false} placeholder={t('bm.search')} onChange={(e) => setQ(e.target.value)} /><Kbd>⌥⌘B</Kbd></div>
        <div className="bm-main">
          <aside className="bm-side">
            <button className={sel === 'all' ? 'on' : ''} onClick={() => setSel('all')}><IcBookmark />{t('bm.all')}<em>{list.length}</em></button>
            <button className={sel === 'root' ? 'on' : ''} onClick={() => setSel('root')}><IcFolder />{t('bm.root')}<em>{list.filter((b) => !b.folder).length}</em></button>
            {folders.map((f) => (renaming?.from === f
              ? <input key={f} autoFocus value={renaming.to} onChange={(e) => setRenaming({ from: f, to: e.target.value })} onBlur={rename} onKeyDown={(e) => { if (e.key === 'Enter') rename(); if (e.key === 'Escape') setRenaming(null) }} />
              : <button key={f} className={sel === f ? 'on' : ''} onClick={() => setSel(f)} onDoubleClick={() => setRenaming({ from: f, to: f })}><IcFolder />{f}<em>{list.filter((b) => b.folder === f).length}</em></button>))}
            {newName !== null
              ? <input autoFocus value={newName} placeholder={t('bm.folderName')} onChange={(e) => setNewName(e.target.value)} onBlur={addFolder} onKeyDown={(e) => { if (e.key === 'Enter') addFolder(); if (e.key === 'Escape') setNewName(null) }} />
              : <button className="ghost" onClick={() => setNewName('')}>+ {t('bm.newFolder')}</button>}
            {sel !== 'all' && sel !== 'root' && <div className="bm-fact"><button onClick={() => setRenaming({ from: sel, to: sel })}>{t('bm.rename')}</button><button onClick={() => { void api.bmFolder(sel); setExtra((x) => x.filter((f) => f !== sel)); setSel('all') }}>{t('bm.deleteFolder')}</button></div>}
          </aside>
          <div className="bm-list">
            {shown.length === 0 && <div className="hub-empty">{t('bm.noBookmarks')}</div>}
            {shown.map((b) => (
              <div className="bm-row" key={b.url}>
                <span className="hist-ic">{favicons[originKey(b.url) ?? ''] ? <img alt="" src={favicons[originKey(b.url) ?? '']} /> : <i />}</span>
                <input className="bm-t" defaultValue={b.title} aria-label={t('bm.titleCol')} onBlur={(e) => { if (e.target.value !== b.title) void api.bmUpdate({ url: b.url, title: e.target.value }) }} />
                <input className="bm-u" defaultValue={b.url} spellCheck={false} onBlur={(e) => { if (e.target.value !== b.url) void api.bmUpdate({ url: b.url, newUrl: e.target.value }) }} />
                <select value={b.folder ?? ''} aria-label={t('bm.folderCol')} onChange={(e) => void api.bmUpdate({ url: b.url, folder: e.target.value || null })}><option value="">{t('bm.root')}</option>{folders.map((f) => <option key={f} value={f}>{f}</option>)}</select>
                <button className="hist-x" style={{ opacity: 1 }} aria-label={t('bm.delete')} title={t('bm.delete')} onClick={() => void api.bmRemove(b.url)}>×</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}
