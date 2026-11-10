import { useState } from 'react'
import { toast, useT } from './store'

/** Etkin Workspace'in aciik sekmelerini adlandirip oturum olarak kaydeder. */
export function SessionPrompt({ onClose }: { onClose(): void }) {
  const t = useT()
  const [name, setName] = useState('')
  const ok = async (): Promise<void> => {
    const id = await window.izlix.saveSession(name.trim() || new Date().toLocaleString())
    toast(t(id ? 'sess.saved' : 'sess.none')); onClose()
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('sess.save')} style={{ width: 'min(420px, 92vw)', padding: 16, gap: 10 }} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter') void ok() }}>
        <b>{t('sess.save')}</b>
        <input autoFocus value={name} maxLength={80} placeholder={t('sess.namePh')} onChange={(e) => setName(e.target.value)} />
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}><button className="btn" onClick={onClose}>{t('rr.close')}</button><button className="btn primary" onClick={() => void ok()}>{t('rr.save')}</button></div>
      </div>
    </div>
  )
}
