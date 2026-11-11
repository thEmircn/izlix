import { useEffect, useMemo, useState } from 'react'
import qrcode from 'qrcode-generator'
import { useStore, useT, toast } from './store'
import { Kbd } from './ui'

/** Sayfa adresi icin QR kodu (telefona gonderme): kutuphane SVG uretir, beyaz zeminde taranabilir. */
export function QrDialog({ tabId, onClose }: { tabId: string; onClose(): void }) {
  const t = useT()
  const pageUrl = useStore((s) => s.tabs.find((x) => x.id === tabId)?.url ?? '')
  const [lan, setLan] = useState<{ url: string; ip: string; reachable: boolean } | null>(null)
  const [mode, setMode] = useState<'page' | 'lan'>('page')
  useEffect(() => { void window.izlix.lanInfo(tabId).then((l: typeof lan) => { setLan(l); if (l) setMode('lan') }) }, [tabId])
  const url = mode === 'lan' && lan ? lan.url : pageUrl
  const svg = useMemo(() => {
    if (!/^https?:/.test(url) || url.length > 1000) return ''
    const q = qrcode(0, 'M'); q.addData(url); q.make()
    return q.createSvgTag({ cellSize: 6, margin: 3, scalable: true })
  }, [url])
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('qr.title')} style={{ width: 'min(360px, 92vw)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}><b style={{ flex: 1, fontSize: 14 }}>{t('qr.title')}</b><Kbd>esc</Kbd></div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          {lan && <div className="seg2" style={{ alignSelf: 'center' }}><button className={mode === 'lan' ? 'on' : ''} onClick={() => setMode('lan')}>{t('qr.lan')}</button><button className={mode === 'page' ? 'on' : ''} onClick={() => setMode('page')}>{t('qr.page')}</button></div>}
          {svg ? <div className="qrbox" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="shint">{t('qr.none')}</div>}
          <div className="shint" style={{ wordBreak: 'break-all', textAlign: 'center', maxHeight: 60, overflow: 'hidden' }}>{url}</div>
          {mode === 'lan' && lan && <div className="shint" style={{ textAlign: 'center', color: lan.reachable ? 'var(--ok, #6ee7a8)' : 'var(--warn, #f5b94a)' }}>{lan.reachable ? t('qr.lanOk') : t('qr.lanNo', { ip: lan.ip })}</div>}
          <button className="btn" onClick={() => { void navigator.clipboard.writeText(url).then(() => toast(t('qr.copied'))) }}>{t('qr.copy')}</button>
        </div>
      </div>
    </div>
  )
}
