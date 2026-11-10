import { useStore, useT, wsName } from './store'
import { IcFolder, IcServer, Plus, Star } from './icons'

/** Sekme yokken gorunen ana sayfa: Workspace, calisan dev sunuculari, yer imleri, hizli eylemler. */
export function Home({ style }: { style: React.CSSProperties }) {
  const t = useT()
  const s = useStore()
  const ws = s.workspaces.find((w) => w.id === s.activeWorkspaceId)
  const marks = s.bookmarks[s.activeWorkspaceId] ?? []
  const api = window.izlix
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
