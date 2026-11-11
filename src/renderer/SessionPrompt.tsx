import { useState } from 'react'
import { PromptDialog } from '../../packages/ui/src'
import { toast, useT } from './store'

/** Etkin Workspace'in aciik sekmelerini adlandirip oturum olarak kaydeder. */
export function SessionPrompt({ onClose }: { onClose(): void }) {
  const t = useT()
  const [name, setName] = useState('')
  const ok = async (): Promise<void> => {
    const id = await window.izlix.saveSession(name.trim() || new Date().toLocaleString())
    toast(t(id ? 'sess.saved' : 'sess.none')); onClose()
  }
  return <PromptDialog title={t('sess.save')} value={name} onChange={setName} maxLength={80} placeholder={t('sess.namePh')} confirmLabel={t('rr.save')} cancelLabel={t('rr.close')} onConfirm={() => void ok()} onClose={onClose} />
}
