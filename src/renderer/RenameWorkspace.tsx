import { useState } from 'react'
import { PromptDialog } from '../../packages/ui/src'
import { useStore, useT } from './store'

export function RenameWorkspace({ onClose }: { onClose(): void }) {
  const t = useT()
  const ws = useStore((s) => s.workspaces.find((w) => w.id === s.activeWorkspaceId))
  const [name, setName] = useState(ws?.name ?? '')
  const ok = async (): Promise<void> => { if (ws && name.trim()) await window.izlix.renameWorkspace(ws.id, name.trim()); onClose() }
  return <PromptDialog title={t('ws.rename.title')} value={name} onChange={setName} maxLength={64} confirmLabel={t('ws.rename.ok')} cancelLabel={t('rr.close')} onConfirm={() => void ok()} onClose={onClose} />
}
