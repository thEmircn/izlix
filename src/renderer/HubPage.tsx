import { useState } from 'react'
import { DEFAULT_HUB, SERVICES, serviceUrl, type HubSettings } from '../shared/services'
import { useStore, useT } from './store'
import { Kbd, Roll } from './ui'

/** Hub: gunluk uygulamalar tek yerde. Her biri kendi izole oturumunda web surumuyle calisir; okunmamis sayilari burada toplanir. */
export function HubPage({ onClose }: { onClose(): void }) {
  const t = useT()
  const tabs = useStore((s) => s.tabs), settings = useStore((s) => s.settings)
  const hub: HubSettings = { ...DEFAULT_HUB, ...(settings.hub ?? {}) }
  const [urlDraft, setUrlDraft] = useState(hub.urls.youtrack ?? '')
  const api = window.izlix
  const save = (p: Partial<HubSettings>): void => { void api.setSettings({ hub: { ...hub, ...p } }) }
  const state = (id: string) => { const tab = tabs.find((x) => x.service === id); return { tab, unread: tab?.unread ?? 0 } }
  const on = SERVICES.filter((s) => hub.enabled.includes(s.id))
  const total = on.reduce((a, s) => a + state(s.id).unread, 0)
  const open = (id: string, bg = false): void => { void api.hubOpen(id, bg).then(() => { if (!bg) onClose() }) }
  const startAll = (): void => { for (const s of on) if (serviceUrl(s, hub) && !state(s.id).tab) void api.hubOpen(s.id, true) }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog svc-dialog" role="dialog" aria-label={t('svch.title')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('svch.title')}</b><span className="svc-total" data-testid="hub-total"><Roll text={total} /> {t('svch.unread')}</span><span style={{ flex: 1 }} /><Kbd>esc</Kbd></div>
        <div className="svc-grid">
          {SERVICES.map((s) => {
            const enabled = hub.enabled.includes(s.id), st = state(s.id), url = serviceUrl(s, hub)
            return (
              <div key={s.id} className={`svc-card ${enabled ? '' : 'off'}`} data-testid={`svc-${s.id}`}>
                <div className="svc-top">
                  <span className="svc-ico" style={{ background: s.color }}>{s.name[0]}</span>
                  <b>{s.name}</b>
                  <span style={{ flex: 1 }} />
                  <button className="svc-sw" role="switch" aria-checked={enabled} aria-label={s.name} onClick={() => save({ enabled: enabled ? hub.enabled.filter((x) => x !== s.id) : [...hub.enabled, s.id] })}><i /></button>
                </div>
                {enabled && <>
                  <div className="svc-count" style={{ color: st.unread ? s.color : 'var(--dim)' }}><Roll text={st.unread} /></div>
                  {s.google && <div className="shint">{t('svch.googleNote')}</div>}
                  <div className="svc-state">{st.tab ? t('svch.running') : url ? t('svch.stopped') : t('svch.needUrl')}</div>
                  {s.custom && <input className="svc-url" value={urlDraft} placeholder="acme.youtrack.cloud" aria-label={`${s.name} URL`} onChange={(e) => setUrlDraft(e.target.value)} onBlur={() => save({ urls: { ...hub.urls, [s.id]: urlDraft.trim() } })} onKeyDown={(e) => { if (e.key === 'Enter') save({ urls: { ...hub.urls, [s.id]: urlDraft.trim() } }) }} />}
                  <div className="svc-act">
                    <button className="btn primary" disabled={!url && !st.tab} onClick={() => open(s.id)}>{t('svch.open')}</button>
                    {!st.tab && url && <button className="btn" onClick={() => open(s.id, true)}>{t('svch.startBg')}</button>}
                    {s.google && <button className="btn" onClick={() => void api.hubOpen(s.id, false, true)}>{t('svch.external')}</button>}
                  </div>
                </>}
              </div>
            )
          })}
        </div>
        <div className="svc-foot">
          <button className="btn" onClick={startAll}>{t('svch.startAll')}</button>
          <button className="btn" onClick={() => void api.hubNext().then((id: string | null) => { if (id) onClose() })} disabled={total === 0}>{t('svch.next')}</button>
          <label className="svc-auto"><button className="svc-sw" role="switch" aria-checked={hub.autostart} aria-label={t('svch.autostart')} onClick={() => save({ autostart: !hub.autostart })}><i /></button>{t('svch.autostart')}</label>
        </div>
        <div className="shint" style={{ padding: '0 16px 12px' }}>{t('svch.note')}</div>
      </div>
    </div>
  )
}
