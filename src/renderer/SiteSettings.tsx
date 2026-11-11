import { useEffect, useState } from 'react'
import { Switch } from '../../packages/ui/src'
import { useStore, useT, toast } from './store'
import { Kbd } from './ui'


/** Site ayarlari: bu sitenin yakinlastirmasi, zorla karanligi, kendi CSS'i, izinleri ve site verisi. */
export function SiteSettings({ tabId, onClose }: { tabId: string; onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const tab = useStore((s) => s.tabs.find((x) => x.id === tabId))
  const events = useStore((s) => s.events)
  const [site, setSite] = useState<{ host: string; zoom?: number; dark?: boolean; css?: string } | null>(null)
  const [css, setCss] = useState('')
  const [perms, setPerms] = useState<{ origin: string; permission: string; decision: string }[]>([])
  const origin = (() => { try { return new URL(tab?.url ?? '').origin } catch { return '' } })()
  const load = (): void => { void api.siteGet(tabId).then((s: typeof site) => { setSite(s); setCss(s?.css ?? '') }) }
  useEffect(() => { load(); void api.permList().then((l: any) => setPerms((l ?? []).filter((p: any) => p.origin === origin))) }, [tabId, origin])
  // yakinlastirma/karanlik disaridan (menu, palet) degisince guncelle
  useEffect(() => { load() }, [tab?.site?.zoom, tab?.site?.dark])
  if (!site) return null
  const zoom = site.zoom ?? 1
  // baglanti/sertifika: bu sekmenin ayni kaynaktan son belge yanitindaki TLS ayrintilari
  const sec = (() => {
    let best: any = null
    for (const ev of events.values()) if (ev.tabId === tabId && ev.kind === 'response' && ev.payload.type === 'Document' && ev.payload.url.startsWith(origin) && (!best || ev.ts > best.ts)) best = ev
    return best?.payload?.security as { protocol: string; cipher: string; subject: string; issuer: string; validFrom: number; validTo: number } | undefined
  })()
  const date = (s: number): string => new Date(s * 1000).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('site.title')} style={{ width: 'min(520px, 92vw)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}><b style={{ flex: 1, fontSize: 14 }}>{site.host}</b><Kbd>esc</Kbd></div>
        <div style={{ overflow: 'auto', padding: '4px 18px 14px' }}>
          <div className="srow" style={{ alignItems: 'flex-start' }}><div><div className="stitle">{t('site.conn')}</div></div>
            <div style={{ width: '62%', fontSize: 12.5, lineHeight: 1.6 }}>
              {origin.startsWith('https:') && sec ? (<>
                <div style={{ color: 'var(--ok, #6ee7a8)' }}>{t('site.secure')} · {sec.protocol} · {sec.cipher}</div>
                <div>{t('site.certTo')}: <b>{sec.subject}</b></div><div>{t('site.certBy')}: {sec.issuer}</div><div>{t('site.certValid')}: {date(sec.validFrom)} – {date(sec.validTo)}</div>
              </>) : origin.startsWith('https:') ? <div style={{ color: 'var(--ok, #6ee7a8)' }}>{t('site.secure')}</div> : <div style={{ color: 'var(--warn, #f5b94a)' }}>{t('site.notSecure')}</div>}
            </div></div>
          <div className="srow"><div><div className="stitle">{t('site.zoom')}</div></div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
              <button className="btn" onClick={() => void api.zoom(tabId, 'out')}>−</button><b style={{ minWidth: 48, textAlign: 'center' }}>{Math.round(zoom * 100)}%</b><button className="btn" onClick={() => void api.zoom(tabId, 'in')}>+</button><button className="btn" onClick={() => void api.zoom(tabId, 'reset')}>{t('site.reset')}</button>
            </div></div>
          <div className="srow"><div><div className="stitle">{t('site.dark')}</div><div className="shint">{t('site.darkHint')}</div></div><div><Switch on={!!site.dark} label={t('site.dark')} onChange={(v) => void api.siteSet(tabId, { dark: v })} /></div></div>
          <div className="srow" style={{ alignItems: 'flex-start' }}><div><div className="stitle">{t('site.css')}</div><div className="shint">{t('site.cssHint')}</div></div>
            <div style={{ width: '60%' }}><textarea value={css} spellCheck={false} rows={5} placeholder="body { font-size: 18px; }" style={{ width: '100%', fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12 }} onChange={(e) => setCss(e.target.value)} />
              <div style={{ marginTop: 6 }}><button className="btn primary" onClick={() => void api.siteSet(tabId, { css }).then(() => toast(t('site.saved')))}>{t('site.save')}</button></div></div></div>
          <div className="srow" style={{ alignItems: 'flex-start' }}><div><div className="stitle">{t('site.perms')}</div></div>
            <div style={{ width: '60%' }}>{perms.length === 0 ? <span className="shint">{t('site.noPerms')}</span> : perms.map((p) => (
              <div key={p.permission} style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 4 }}><span style={{ flex: 1 }}>{p.permission} · {p.decision}</span><button className="btn" onClick={() => void api.permRemove(p.origin, p.permission).then(() => setPerms((l) => l.filter((x) => x !== p)))}>{t('site.reset')}</button></div>
            ))}</div></div>
          <div className="srow"><div><div className="stitle">{t('site.clear')}</div><div className="shint">{t('site.clearHint')}</div></div><div><button className="btn" onClick={() => void api.siteClear(tabId).then(() => { toast(t('site.cleared')); onClose() })}>{t('site.clearBtn')}</button></div></div>
        </div>
      </div>
    </div>
  )
}
