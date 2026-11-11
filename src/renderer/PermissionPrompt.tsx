import { useEffect } from 'react'
import { useStore, useT } from './store'

const LABEL: Record<string, string> = { camera: 'perm.camera', microphone: 'perm.microphone', geolocation: 'perm.geolocation', notifications: 'perm.notifications', 'clipboard-read': 'perm.clipboard', midi: 'perm.midi', 'display-capture': 'perm.screen' }

/** Site izin istegi (modal): bir kez izin ver / her zaman izin ver / engelle. */
export function PermissionPrompt() {
  const t = useT()
  const prompts = useStore((s) => s.permPrompts)
  const p = prompts[0]
  const answer = (a: 'allow-once' | 'allow' | 'block' | 'dismiss'): void => {
    if (!p) return
    void window.izlix.permAnswer(p.id, a)
    useStore.setState((s) => ({ permPrompts: s.permPrompts.filter((x) => x.id !== p.id) }))
  }
  // Esc: karar kaydetmeden kapat (site yalnizca bu seferlik reddedilir)
  useEffect(() => { if (!p) return; const h = (e: KeyboardEvent): void => { if (e.key === 'Escape') answer('dismiss') }; window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h) }, [p?.id])
  if (!p) return null
  return (
    <div className="overlay" style={{ zIndex: 70 }}>
      <div className="dialog" role="alertdialog" aria-label={t('perm.title')} style={{ width: 'min(460px, 92vw)', padding: 20, gap: 14 }}>
        <div style={{ fontSize: 14 }}><b>{p.origin}</b> {t('perm.wants')} <b>{t((LABEL[p.permission] ?? 'perm.unknown') as any)}</b></div>
        <div style={{ color: 'var(--dim)' }}>{t('perm.hint')}</div>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button className="btn" onClick={() => answer('block')}>{t('perm.block')}</button>
          <button className="btn" onClick={() => answer('allow-once')}>{t('perm.once')}</button>
          <button className="btn primary" onClick={() => answer('allow')}>{t('perm.always')}</button>
        </div>
      </div>
    </div>
  )
}
