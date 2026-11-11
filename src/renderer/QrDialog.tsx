import { useMemo } from 'react'
import qrcode from 'qrcode-generator'
import { useStore, useT, toast } from './store'
import { Kbd } from './ui'

/** Sayfa adresi icin QR kodu (telefona gonderme): kutuphane SVG uretir, beyaz zeminde taranabilir. */
export function QrDialog({ tabId, onClose }: { tabId: string; onClose(): void }) {
  const t = useT()
  const url = useStore((s) => s.tabs.find((x) => x.id === tabId)?.url ?? '')
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
          {svg ? <div className="qrbox" dangerouslySetInnerHTML={{ __html: svg }} /> : <div className="shint">{t('qr.none')}</div>}
          <div className="shint" style={{ wordBreak: 'break-all', textAlign: 'center', maxHeight: 60, overflow: 'hidden' }}>{url}</div>
          <button className="btn" onClick={() => { void navigator.clipboard.writeText(url).then(() => toast(t('qr.copied'))) }}>{t('qr.copy')}</button>
        </div>
      </div>
    </div>
  )
}
