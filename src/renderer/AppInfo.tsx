import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { installability, installable, mergeSw, parseManifest, type SwReg, type SwVer } from '../shared/pwa'
import { toast, useStore, useT } from './store'

type Dt = (m: string, p?: Record<string, unknown>) => Promise<any>

/** Uygulama: PWA manifest, kurulabilirlik kontrolleri ve service worker kayitlari (guncelle / bekletmeyi atla / kaldir). */
export function AppInfo({ dt, rev }: { dt: Dt; rev: number }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [man, setMan] = useState<{ url: string; data?: string; errors: { message: string }[] } | null | undefined>(undefined)
  const [regs, setRegs] = useState<SwReg[]>([])
  const [vers, setVers] = useState<SwVer[]>([])
  const [force, setForce] = useState(false)
  const regsRef = useRef<Map<string, SwReg>>(new Map()), versRef = useRef<Map<string, SwVer>>(new Map())

  const loadManifest = useCallback(async () => { setMan(undefined); const r = await dt('Page.getAppManifest'); setMan(r ? { url: r.url, data: r.data, errors: r.errors ?? [] } : null) }, [dt])
  useEffect(() => { void loadManifest() }, [loadManifest, rev])
  useEffect(() => {
    if (!tabId) return
    void window.izlix.dtEnable(tabId, 'sw')
    const off = window.izlix.onDt((e: any) => {
      if (e.id !== useStore.getState().activeTabId) return
      if (e.method === 'ServiceWorker.workerRegistrationUpdated') { for (const r of e.params.registrations ?? []) regsRef.current.set(r.registrationId, r); setRegs([...regsRef.current.values()]) }
      else if (e.method === 'ServiceWorker.workerVersionUpdated') { for (const v of e.params.versions ?? []) versRef.current.set(v.versionId, v); setVers([...versRef.current.values()]) }
    })
    return () => { off(); void window.izlix.dtDisable(tabId, 'sw'); void window.izlix.dt(tabId, 'ServiceWorker.setForceUpdateOnPageLoad', { forceUpdateOnPageLoad: false }).catch(() => {}) }
  }, [tabId])

  const manifest = useMemo(() => parseManifest(man?.data), [man])
  const checks = useMemo(() => installability(manifest), [manifest])
  const sw = useMemo(() => mergeSw(regs, vers), [regs, vers])
  const act = async (m: string, p: Record<string, unknown>, ok: string): Promise<void> => { await dt(m, p); toast(ok) }

  return (
    <div className="appinfo">
      <section className="lab-sec">
        <h5>{t('pwa.manifest')} {man?.url && <span className="mdim">{man.url.split('/').pop()}</span>}</h5>
        {man === undefined && <div className="skeleton" style={{ height: 40 }} />}
        {man !== undefined && !manifest && <div className="tsub">{t('pwa.noManifest')}</div>}
        {manifest && (
          <>
            <div className="pwa-kv">
              {([['name', manifest.name || manifest.shortName], ['start_url', manifest.startUrl], ['display', manifest.display], ['scope', manifest.scope || '—'], ['theme_color', manifest.themeColor], ['background_color', manifest.backgroundColor]] as [string, string][]).map(([k, v]) => (
                <div key={k}><span>{k}</span><code>{(k.includes('color') && v) ? <><i className="sw" style={{ background: v }} />{v}</> : v || '—'}</code></div>
              ))}
            </div>
            <div className="mlabel" style={{ marginTop: 6 }}>{t('pwa.icons')} <span className="mdim">{manifest.icons.length}</span></div>
            <div className="trk-chips">{manifest.icons.map((i, k) => <span key={k} className="rchip" title={i.src}>{i.sizes || '?'}{i.purpose ? ` · ${i.purpose}` : ''}</span>)}</div>
          </>
        )}
        {man?.errors?.length ? <div className="pwa-err">{man.errors.map((e, i) => <div key={i}>{e.message}</div>)}</div> : null}
      </section>

      {checks.length > 0 && (
        <section className="lab-sec">
          <h5>{t('pwa.install')} <span className={`pill ${installable(checks) ? 'ok' : 'bad'}`}><i />{installable(checks) ? t('pwa.installable') : t('pwa.notInstallable')}</span></h5>
          {checks.map((c) => <div key={c.id} className={`pwa-chk ${c.ok ? 'ok' : c.required ? 'bad' : 'warn'}`}><i />{t(`pwa.c.${c.id}` as any)}{!c.required && <small>{t('pwa.optional')}</small>}</div>)}
        </section>
      )}

      <section className="lab-sec">
        <h5>Service Workers <span className="mdim">{sw.length}</span>
          <label className="tgl" style={{ marginLeft: 'auto' }}><input type="checkbox" checked={force} onChange={(e) => { setForce(e.target.checked); void dt('ServiceWorker.setForceUpdateOnPageLoad', { forceUpdateOnPageLoad: e.target.checked }) }} />{t('pwa.forceUpdate')}</label></h5>
        {!sw.length && <div className="tsub">{t('pwa.noSw')}</div>}
        {sw.map((w) => (
          <div key={w.registrationId} className="sw-card">
            <div className="sw-h"><span className={`pill ${w.running === 'running' ? 'ok' : ''}`}><i />{w.status} · {w.running}</span><b>{w.script.split('/').pop() || '—'}</b><code>{t('pwa.clients', { n: w.clients })}</code></div>
            <div className="tsub" title={w.scope}>{t('pwa.scope')}: {w.scope}</div>
            <div className="qa">
              <button className="btn sm" onClick={() => void act('ServiceWorker.updateRegistration', { scopeURL: w.scope }, t('pwa.updated'))}>{t('pwa.update')}</button>
              <button className="btn sm" onClick={() => void act('ServiceWorker.skipWaiting', { scopeURL: w.scope }, t('pwa.skipped'))}>{t('pwa.skip')}</button>
              <button className="btn sm" onClick={() => void act('ServiceWorker.unregister', { scopeURL: w.scope }, t('pwa.unregistered'))}>{t('pwa.unregister')}</button>
            </div>
          </div>
        ))}
        {sw.length > 0 && <button className="btn sm" style={{ justifySelf: 'start' }} onClick={() => void act('ServiceWorker.stopAllWorkers', {}, t('pwa.stopped'))}>{t('pwa.stopAll')}</button>}
      </section>
    </div>
  )
}
