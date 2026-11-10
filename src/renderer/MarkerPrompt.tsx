import { useState } from 'react'
import { toast, useStore, useT } from './store'

/** Timeline'a not/isaret ekler (hata raporuna da girer): "burada hata gordum". */
export function MarkerPrompt({ onClose }: { onClose(): void }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [text, setText] = useState('')
  const ok = async (): Promise<void> => { const v = text.trim() || t('marker.default'); if (tabId) { await window.izlix.addMarker(tabId, v); toast(t('marker.added')) } onClose() }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('marker.title')} style={{ width: 'min(420px, 92vw)', padding: 16, gap: 10 }} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') void ok() }}>
        <b>{t('marker.title')}</b>
        <input autoFocus value={text} maxLength={200} placeholder={t('marker.default')} onChange={(e) => setText(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>{t('rr.close')}</button><button className="btn primary" onClick={() => void ok()}>{t('marker.add')}</button></div>
      </div>
    </div>
  )
}
