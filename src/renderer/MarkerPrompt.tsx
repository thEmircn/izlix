import { useState } from 'react'
import { PromptDialog } from '../../packages/ui/src'
import { toast, useStore, useT } from './store'

/** Timeline'a not/isaret ekler (hata raporuna da girer): "burada hata gordum". */
export function MarkerPrompt({ onClose }: { onClose(): void }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const [text, setText] = useState('')
  const ok = async (): Promise<void> => { const v = text.trim() || t('marker.default'); if (tabId) { await window.izlix.addMarker(tabId, v); toast(t('marker.added')) } onClose() }
  return <PromptDialog title={t('marker.title')} value={text} onChange={setText} maxLength={200} placeholder={t('marker.default')} confirmLabel={t('marker.add')} cancelLabel={t('rr.close')} onConfirm={() => void ok()} onClose={onClose} />
}
