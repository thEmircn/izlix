import { useEffect, useState } from 'react'
import { useStore, useT, wsName } from './store'
import { IcFolder, IcServer, Plus, Star } from './icons'

/** Sekme yokken gorunen ana sayfa: Workspace, calisan dev sunuculari, yer imleri, hizli eylemler. */
export function Home({ style }: { style: React.CSSProperties }) {
  const t = useT()
  const s = useStore()
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  const marks = s.bookmarks[s.activeWorkspaceId] ?? []
  const sess = s.sessions[s.activeWorkspaceId] ?? []
  const api = window.izlix
  const [recent, setRecent] = useState<{ url: string; title: string; ts: number }[]>([])
  useEffect(() => { void api.history().then((h: { url: string; title: string; ts: number }[]) => setRecent((h ?? []).slice(0, 6))).catch(() => {}) }, [])
  return (
    <div className="home" style={style}>
      <div className="home-in">
        <div className="mlabel">{t('home.title')}</div>
        <h1>{wsName(ws) || 'Workspace'}</h1>
        <p className="home-sub">{ws?.rootDir ?? t('home.noFolder')}</p>
        <div className="bento">
          <div className="tile wide">
            <div className="mlabel">{t('home.servers')}</div>
            {s.detected.length ? s.detected.map((d) => (
              <button key={d.port} className="act" onClick={() => api.createTab(`localhost:${d.port}`)}><i style={{ background: 'var(--ok)' }} /><code>:{d.port}</code><span>{d.framework ?? 'dev server'}</span><em>{d.cwd?.split('/').slice(-1)[0] ?? ''}</em></button>
            )) : <div className="tsub">{t('home.noServers')}</div>}
          </div>
          <div className="tile wide">
            <div className="mlabel">{t('home.bookmarks')}</div>
            {marks.length ? marks.slice(0, 6).map((b) => (
              <button key={b.url} className="act" onClick={() => api.createTab(b.url)}><Star /><span>{b.title || b.url}</span><em>{b.url.replace(/^https?:\/\//, '').slice(0, 28)}</em></button>
            )) : <div className="tsub">{t('home.noBookmarks')}</div>}
          </div>
          <div className="tile wide">
            <div className="mlabel">{t('home.recent')}</div>
            {recent.length ? recent.map((v) => (
              <button key={v.url} className="act" onClick={() => api.createTab(v.url)}><i style={{ background: 'var(--dim)' }} /><code>{new Date(v.ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}</code><span>{v.title || v.url}</span><em>{v.url.replace(/^https?:\/\//, '').slice(0, 24)}</em></button>
            )) : <div className="tsub">{t('home.noRecent')}</div>}
          </div>
          <div className="tile wide">
            <div className="mlabel">{t('home.shortcuts')}</div>
            {([['⌘T', 'menu.newTab'], ['⌘K', 'menu.palette'], ['⌘L', 'menu.openLoc'], ['⌥⌘1', 'tl.overview'], ['⌘D', 'menu.bookmark'], ['⇧⌘M', 'menu.marker']] as [string, any][]).map(([k, l]) => (
              <div key={k} className="act" style={{ cursor: 'default' }}><i style={{ background: 'var(--ac)' }} /><code>{k}</code><span>{t(l)}</span><em /></div>
            ))}
          </div>
          <div className="tile full">
            <div className="mlabel">{t('sess.title')} <button className="btn sm" style={{ marginLeft: 10 }} onClick={() => s.set({ overlay: 'session' })}>{t('sess.save')}</button></div>
            {sess.length ? sess.slice(0, 6).map((x) => (
              <div key={x.id} className="act sessrow" style={{ cursor: 'default' }}><i style={{ background: 'var(--ac)' }} /><code>{t('sess.tabs', { n: x.tabs.length })}</code><span>{x.name}</span>
                <em><button className="link" onClick={() => void api.openSession(x.id)}>{t('sess.open')}</button> · <button className="link" onClick={() => void api.deleteSession(x.id)}>{t('sess.del')}</button></em></div>
            )) : <div className="tsub">{t('sess.empty')}</div>}
          </div>
          <div className="tile full row">
            <button className="btn primary" onClick={() => api.createTab()}><Plus />{t('tab.new')}</button>
            <button className="btn" onClick={() => void api.createWorkspace('', null)}><IcFolder />{t('ws.fromFolder')}</button>
            <button className="btn" onClick={() => s.set({ overlay: 'palette' })}><IcServer />{t('home.palette')} <kbd className="kbd">⌘K</kbd></button>
          </div>
        </div>
      </div>
    </div>
  )
}
