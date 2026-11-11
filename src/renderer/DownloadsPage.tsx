import { formatBytes } from '../shared/network'
import type { DlInfo } from '../shared/events'
import { useStore, useT } from './store'
import { Kbd } from './ui'

const eta = (d: DlInfo): string => { if (!d.speed || !d.total || d.paused) return ''; const s = Math.max(0, Math.round((d.total - d.received) / d.speed)); return s >= 3600 ? `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m` : s >= 60 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s` }

/** Indirme yoneticisi (⇧⌘J): ilerleme, hiz, kalan sure; duraklat/surdur/iptal/ac/klasorde goster/kaldir; gecmis oturumlarda kalici. */
export function DownloadsPage({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const list = useStore((s) => s.downloads)
  const rows = [...list].reverse()
  const act = (id: string, a: Parameters<typeof api.downloadAct>[1]): void => { void api.downloadAct(id, a) }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog dl" role="dialog" aria-label={t('menu.downloads')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('menu.downloads')}</b><span style={{ flex: 1 }} />{rows.some((d) => d.state !== 'progressing') && <button className="btn" onClick={() => act('', 'clear')}>{t('dl.clearDone')}</button>}<Kbd>⇧⌘J</Kbd></div>
        <div className="dl-list">
          {rows.length === 0 && <div className="hub-empty">{t('dl.empty')}</div>}
          {rows.map((d) => {
            const pct = d.total > 0 ? Math.min(100, Math.round((d.received / d.total) * 100)) : 0
            return (
              <div className={`dl-row ${d.state}`} key={d.id}>
                <span className="dl-ic">{(d.name.split('.').pop() ?? '').slice(0, 4).toUpperCase() || '·'}</span>
                <div className="dl-main">
                  <b title={d.path}>{d.name}</b>
                  {d.state === 'progressing' && <><div className="dl-bar"><i style={{ width: `${pct}%` }} className={d.paused ? 'paused' : ''} /></div>
                    <small>{formatBytes(d.received)}{d.total ? ` / ${formatBytes(d.total)}` : ''}{d.paused ? ` · ${t('dl.paused')}` : d.speed ? ` · ${formatBytes(d.speed)}/s` : ''}{eta(d) ? ` · ${eta(d)}` : ''}</small></>}
                  {d.state === 'completed' && <small>{d.missing ? t('dl.missing') : `${formatBytes(d.total || d.received)} · ${t('dl.done')}`}</small>}
                  {(d.state === 'cancelled' || d.state === 'interrupted') && <small className="bad">{t(d.state === 'cancelled' ? 'dl.cancelled' : 'dl.failed')}</small>}
                  {d.url && <small className="dl-url" title={d.url}>{d.url}</small>}
                </div>
                <div className="dl-act">
                  {d.state === 'progressing' && (d.paused ? <button className="btn" onClick={() => act(d.id, 'resume')}>{t('dl.resume')}</button> : <button className="btn" onClick={() => act(d.id, 'pause')}>{t('dl.pause')}</button>)}
                  {d.state === 'progressing' && <button className="btn" onClick={() => act(d.id, 'cancel')}>{t('dl.cancel')}</button>}
                  {d.state === 'completed' && !d.missing && <button className="btn primary" onClick={() => act(d.id, 'open')}>{t('dl.open')}</button>}
                  {d.state === 'completed' && !d.missing && <button className="btn" onClick={() => act(d.id, 'show')}>{t('dl.show')}</button>}
                  {d.state !== 'progressing' && <button className="hist-x" style={{ opacity: 1 }} aria-label={t('dl.remove')} title={t('dl.remove')} onClick={() => act(d.id, 'remove')}>×</button>}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
