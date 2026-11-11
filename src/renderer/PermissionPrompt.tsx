import { Button, Dialog } from '../../packages/ui/src'
import { useStore, useT } from './store'

const LABEL: Record<string, string> = { 'camera+microphone': 'perm.cameraMic', camera: 'perm.camera', microphone: 'perm.microphone', geolocation: 'perm.geolocation', notifications: 'perm.notifications', 'clipboard-read': 'perm.clipboard', midi: 'perm.midi', 'display-capture': 'perm.screen' }

/** Site izin istegi (modal): bir kez izin ver / her zaman izin ver / engelle. Esc: karar kaydetmeden kapatir. */
export function PermissionPrompt() {
  const t = useT()
  const prompts = useStore((s) => s.permPrompts)
  const p = prompts[0]
  if (!p) return null
  const answer = (a: 'allow-once' | 'allow' | 'block' | 'dismiss'): void => {
    void window.izlix.permAnswer(p.id, a)
    useStore.setState((s) => ({ permPrompts: s.permPrompts.filter((x) => x.id !== p.id) }))
  }
  return (
    <Dialog open role="alertdialog" zIndex={70} width={460} title={t('perm.title')} onClose={() => answer('dismiss')}
      footer={<><Button onClick={() => answer('block')}>{t('perm.block')}</Button><Button onClick={() => answer('allow-once')}>{t('perm.once')}</Button><Button variant="primary" onClick={() => answer('allow')}>{t('perm.always')}</Button></>}>
      <div style={{ fontSize: 14, marginBottom: 8 }}><b>{p.origin}</b> {t('perm.wants')} <b>{t((LABEL[p.permission] ?? 'perm.unknown') as any)}</b></div>
      <div style={{ color: 'var(--dim)' }}>{t('perm.hint')}</div>
    </Dialog>
  )
}
