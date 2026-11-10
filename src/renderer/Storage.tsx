import { useCallback, useEffect, useMemo, useState } from 'react'
import { toast, useStore, useT } from './store'
import { Seg } from './ui'
import { JwtList } from './Jwt'
import { AppInfo } from './AppInfo'
import { findJwts } from '../shared/jwt'

type STab = 'cookies' | 'local' | 'session' | 'idb' | 'cache' | 'app'
type Dt = (m: string, p?: Record<string, unknown>) => Promise<any>

/** Storage paneli: cookie, localStorage, sessionStorage, IndexedDB ve Cache Storage. Duzenle / ekle / sil / temizle. */
export function Storage() {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const url = useStore((s) => s.tabs.find((x) => x.id === s.activeTabId)?.url ?? '')
  const [tab, setTab] = useState<STab>('cookies')
  const [rev, setRev] = useState(0)
  const origin = useMemo(() => { try { const u = new URL(url); return /^https?:$/.test(u.protocol) ? u.origin : '' } catch { return '' } }, [url])
  const dt = useCallback<Dt>((method, params) => (tabId ? window.izlix.dt(tabId, method, params).catch(() => null) : Promise.resolve(null)), [tabId])

  useEffect(() => {
    if (!tabId) return
    void window.izlix.dtEnable(tabId, 'storage')
    const off = window.izlix.onDt((e: any) => { if (e.id === useStore.getState().activeTabId && e.method.startsWith('DOMStorage.')) setRev((r) => r + 1) })
    return () => { off(); void window.izlix.dtDisable(tabId, 'storage') }
  }, [tabId])
  const refresh = (): void => setRev((r) => r + 1)

  if (!origin) return <div className="empty-hint">{t('st.noOrigin')}</div>
  return (
    <div className="st">
      <div className="net-bar"><Seg<STab> small value={tab} onChange={setTab} items={[{ key: 'cookies', label: t('st.cookies') }, { key: 'local', label: 'localStorage' }, { key: 'session', label: 'sessionStorage' }, { key: 'idb', label: 'IndexedDB' }, { key: 'cache', label: 'Cache' }, { key: 'app', label: t('st.app') }]} />
        <span style={{ flex: 1 }} /><span className="origin">{origin}</span><button className="btn" onClick={refresh}>{t('insp.refresh')}</button></div>
      <div className="st-body" key={tab}>
        {tab === 'cookies' && <Cookies dt={dt} url={url} rev={rev} refresh={refresh} />}
        {(tab === 'local' || tab === 'session') && <KeyValues dt={dt} origin={origin} local={tab === 'local'} rev={rev} refresh={refresh} />}
        {tab === 'idb' && <Idb dt={dt} origin={origin} rev={rev} refresh={refresh} />}
        {tab === 'app' && <AppInfo dt={dt} rev={rev} />}
        {tab === 'cache' && <Caches dt={dt} origin={origin} rev={rev} refresh={refresh} />}
      </div>
    </div>
  )
}

const fmtExp = (e: number): string => (e > 0 ? new Date(e * 1000).toLocaleString() : 'Session')

function Cookies({ dt, url, rev, refresh }: { dt: Dt; url: string; rev: number; refresh(): void }) {
  const t = useT()
  const [list, setList] = useState<any[] | null>(null)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState({ name: '', value: '' })
  useEffect(() => { let live = true; void dt('Network.getCookies', { urls: [url] }).then((r) => { if (live) setList(r?.cookies ?? []) }); return () => { live = false } }, [url, rev])
  const rows = (list ?? []).filter((c) => !q || c.name.toLowerCase().includes(q.toLowerCase()) || c.domain.includes(q))
  const save = async (c: any, patch: Record<string, unknown>): Promise<void> => {
    await dt('Network.setCookie', { name: c.name, value: c.value, url, domain: c.domain, path: c.path, secure: c.secure, httpOnly: c.httpOnly, sameSite: c.sameSite, ...(c.expires > 0 ? { expires: c.expires } : {}), ...patch }); refresh()
  }
  return (
    <>
      <div className="st-tools"><input className="search" placeholder={t('st.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn danger" disabled={!rows.length} onClick={async () => { for (const c of rows) await dt('Network.deleteCookies', { name: c.name, domain: c.domain, path: c.path }); toast(t('st.cleared')); refresh() }}>{t('st.clear')}</button></div>
      <table className="tbl st-tbl"><thead><tr><th>{t('st.name')}</th><th>{t('st.value')}</th><th>{t('st.domain')}</th><th>{t('st.path')}</th><th>{t('st.expires')}</th><th>{t('st.flags')}</th><th /></tr></thead>
        <tbody>{rows.map((c) => (
          <tr key={`${c.domain}|${c.path}|${c.name}`}>
            <td className="k">{c.name}</td>
            <td><input defaultValue={c.value} spellCheck={false} onBlur={(e) => { if (e.target.value !== c.value) void save(c, { value: e.target.value }) }} onKeyDown={(e) => { if (e.key === 'Enter') { const v = (e.target as HTMLInputElement).value; if (v !== c.value) void save(c, { value: v }) } }} /></td>
            <td>{c.domain}</td><td>{c.path}</td><td>{fmtExp(c.expires)}</td>
            <td className="flags">{c.httpOnly && <u>HttpOnly</u>}{c.secure && <u>Secure</u>}{c.sameSite && <u>{c.sameSite}</u>}</td>
            <td><button className="icon-btn" aria-label="delete" onClick={() => void dt('Network.deleteCookies', { name: c.name, domain: c.domain, path: c.path }).then(refresh)}>×</button></td>
          </tr>))}
          <tr className="addrow"><td><input placeholder={t('st.name').toLowerCase()} value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} /></td><td><input placeholder={t('st.value').toLowerCase()} value={draft.value} onChange={(e) => setDraft({ ...draft, value: e.target.value })} /></td>
            <td colSpan={4} /><td><button className="btn" disabled={!draft.name.trim()} onClick={() => { void dt('Network.setCookie', { name: draft.name.trim(), value: draft.value, url }).then(refresh); setDraft({ name: '', value: '' }) }}>+</button></td></tr>
        </tbody></table>
      {list && !rows.length && <div className="empty-hint">{t('st.empty')}</div>}
    </>
  )
}

function KeyValues({ dt, origin, local, rev, refresh }: { dt: Dt; origin: string; local: boolean; rev: number; refresh(): void }) {
  const t = useT()
  const [items, setItems] = useState<[string, string][] | null>(null)
  const [q, setQ] = useState('')
  const [draft, setDraft] = useState({ k: '', v: '' })
  const id = useMemo(() => ({ securityOrigin: origin, isLocalStorage: local }), [origin, local])
  useEffect(() => { let live = true; void dt('DOMStorage.getDOMStorageItems', { storageId: id }).then((r) => { if (live) setItems(r?.entries ?? []) }); return () => { live = false } }, [id, rev])
  const rows = (items ?? []).filter(([k, v]) => !q || k.toLowerCase().includes(q.toLowerCase()) || v.toLowerCase().includes(q.toLowerCase()))
  const set = (k: string, v: string): Promise<void> => dt('DOMStorage.setDOMStorageItem', { storageId: id, key: k, value: v }).then(refresh)
  return (
    <>
      <div className="st-tools"><input className="search" placeholder={t('st.filter')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn danger" disabled={!items?.length} onClick={() => void dt('DOMStorage.clear', { storageId: id }).then(() => { toast(t('st.cleared')); refresh() })}>{t('st.clear')}</button></div>
      <table className="tbl st-tbl"><thead><tr><th>{t('st.key')}</th><th>{t('st.value')}</th><th /></tr></thead>
        <tbody>{rows.map(([k, v]) => (
          <tr key={k}><td className="k">{k}{findJwts(v).length > 0 && <u className="jtag" title="JWT">JWT</u>}</td>
            <td><input defaultValue={v} spellCheck={false} onBlur={(e) => { if (e.target.value !== v) void set(k, e.target.value) }} onKeyDown={(e) => { if (e.key === 'Enter') { const nv = (e.target as HTMLInputElement).value; if (nv !== v) void set(k, nv) } }} /></td>
            <td><button className="icon-btn" aria-label="delete" onClick={() => void dt('DOMStorage.removeDOMStorageItem', { storageId: id, key: k }).then(refresh)}>×</button></td></tr>))}
          <tr className="addrow"><td><input placeholder={t('st.key').toLowerCase()} value={draft.k} onChange={(e) => setDraft({ ...draft, k: e.target.value })} /></td><td><input placeholder={t('st.value').toLowerCase()} value={draft.v} onChange={(e) => setDraft({ ...draft, v: e.target.value })} /></td>
            <td><button className="btn" disabled={!draft.k.trim()} onClick={() => { void set(draft.k.trim(), draft.v); setDraft({ k: '', v: '' }) }}>+</button></td></tr>
        </tbody></table>
      <div style={{ padding: '0 10px' }}><JwtList jwts={(items ?? []).flatMap(([, v]) => findJwts(v)).filter((j, i, a) => a.findIndex((x) => x.raw === j.raw) === i)} /></div>
      {items && !rows.length && <div className="empty-hint">{t('st.empty')}</div>}
    </>
  )
}

function Idb({ dt, origin, rev, refresh }: { dt: Dt; origin: string; rev: number; refresh(): void }) {
  const t = useT()
  const [dbs, setDbs] = useState<any[] | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      const names: string[] = (await dt('IndexedDB.requestDatabaseNames', { securityOrigin: origin }))?.databaseNames ?? []
      const out: any[] = []
      for (const n of names) { const d = await dt('IndexedDB.requestDatabase', { securityOrigin: origin, databaseName: n }); if (d?.databaseWithObjectStores) out.push(d.databaseWithObjectStores) }
      if (live) setDbs(out)
    })()
    return () => { live = false }
  }, [origin, rev])
  if (!dbs) return <div className="skeleton" style={{ height: 60, margin: 12 }} />
  if (!dbs.length) return <div className="empty-hint">{t('st.empty')}</div>
  return (
    <div className="idb">{dbs.map((d) => (
      <section key={d.name} className="rule"><h5>{d.name}<small>v{d.version}</small><button className="link" onClick={() => void dt('IndexedDB.deleteDatabase', { securityOrigin: origin, databaseName: d.name }).then(refresh)}>delete</button></h5>
        {d.objectStores.map((s: any) => <div key={s.name} className="prop"><span>{s.name}</span><code>keyPath: {JSON.stringify(s.keyPath?.string ?? s.keyPath?.array ?? null)}{s.autoIncrement ? ' · autoIncrement' : ''}{s.indexes?.length ? ` · ${s.indexes.length} indexes` : ''}</code></div>)}
      </section>))}</div>
  )
}

function Caches({ dt, origin, rev, refresh }: { dt: Dt; origin: string; rev: number; refresh(): void }) {
  const t = useT()
  const [caches, setCaches] = useState<{ cacheId: string; cacheName: string; entries: any[] }[] | null>(null)
  useEffect(() => {
    let live = true
    void (async () => {
      const list: any[] = (await dt('CacheStorage.requestCacheNames', { securityOrigin: origin }))?.caches ?? []
      const out = []
      for (const c of list) { const e = await dt('CacheStorage.requestEntries', { cacheId: c.cacheId, skipCount: 0, pageSize: 100 }); out.push({ cacheId: c.cacheId, cacheName: c.cacheName, entries: e?.cacheDataEntries ?? [] }) }
      if (live) setCaches(out)
    })()
    return () => { live = false }
  }, [origin, rev])
  if (!caches) return <div className="skeleton" style={{ height: 60, margin: 12 }} />
  if (!caches.length) return <div className="empty-hint">{t('st.empty')}</div>
  return (
    <div className="idb">{caches.map((c) => (
      <section key={c.cacheId} className="rule"><h5>{c.cacheName}<small>{c.entries.length} entries</small><button className="link" onClick={() => void dt('CacheStorage.deleteCache', { cacheId: c.cacheId }).then(refresh)}>delete</button></h5>
        {c.entries.map((e) => <div key={e.requestURL} className="prop"><span>{e.requestMethod} {e.responseStatus}</span><code>{e.requestURL}</code></div>)}</section>))}</div>
  )
}
