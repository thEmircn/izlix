import { useStore, useT } from './store'

/** İlk açılış: değer vaadi, demo ve telemetri izni (varsayılan: izin yok, hiçbir şey gönderilmez). */
export function Welcome({ onClose }: { onClose(): void }) {
  const t = useT()
  const consent = useStore((s) => s.settings.telemetry)
  const finish = (): void => { void window.izlix.setSettings({ onboarded: true }); onClose() }
  const demo = async (): Promise<void> => { finish(); await window.izlix.openDemo() }
  return (
    <div className="overlay" style={{ paddingTop: '10vh' }}>
      <div className="dialog" role="dialog" aria-label={t('welcome.title')} style={{ width: 'min(560px, 92vw)', padding: 22, gap: 14 }}>
        <h2 style={{ margin: 0 }}>{t('welcome.title')}</h2>
        <p style={{ margin: 0 }}>{t('welcome.body')}</p>
        <p style={{ margin: 0, color: 'var(--dim)' }}>{t('welcome.step1')}</p>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 12, color: 'var(--dim)' }}>{t('welcome.telemetry')}</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`btn ${consent === 'granted' ? 'primary' : ''}`} onClick={() => void window.izlix.setSettings({ telemetry: 'granted' })}>{t('welcome.allow')}</button>
          <button className={`btn ${consent === 'denied' ? 'primary' : ''}`} onClick={() => void window.izlix.setSettings({ telemetry: 'denied' })}>{t('welcome.deny')}</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={finish}>{t('welcome.skip')}</button>
          <button className="btn primary" onClick={() => void demo()}>{t('welcome.demo')}</button>
        </div>
      </div>
    </div>
  )
}
