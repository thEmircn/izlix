import { useState } from 'react'
import { useStore, useT } from './store'

export function RenameWorkspace({ onClose }: { onClose(): void }) {
  const t = useT()
  const ws = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
  const [name, setName] = useState(ws?.name ?? '')
  const ok = async (): Promise<void> => { if (ws && name.trim()) await window.izlix.renameWorkspace(ws.id, name.trim()); onClose() }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('ws.rename.title')} style={{ width: 'min(420px, 92vw)', padding: 16, gap: 10 }} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') void ok() }}>
        <b>{t('ws.rename.title')}</b>
        <input autoFocus value={name} maxLength={64} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={onClose}>{t('rr.close')}</button>
          <button className="btn primary" onClick={() => void ok()}>{t('ws.rename.ok')}</button>
        </div>
      </div>
    </div>
  )
}
