import { useStore, useT } from './store'
import { Kbd, Spotlight } from './ui'

/** İlk açılış: değer vaadi, demo ve telemetri izni (varsayılan: izin yok, hiçbir şey gönderilmez). */
export function Welcome({ onClose }: { onClose(): void }) {
  const t = useT()
  const consent = useStore((s) => s.settings.telemetry)
  const finish = (): void => { void window.izlix.setSettings({ onboarded: true }); onClose() }
  const demo = async (): Promise<void> => { finish(); await window.izlix.openDemo() }
  const cards: [string, string, string][] = [['01', 'welcome.see', 'welcome.seeD'], ['02', 'welcome.find', 'welcome.findD'], ['03', 'welcome.change', 'welcome.changeD']]
  return (
    <div className="overlay" style={{ paddingTop: '8vh' }}>
      <div className="dialog welcome" role="dialog" aria-label={t('welcome.title')} style={{ width: 'min(680px, 94vw)', padding: 28, gap: 18 }}>
        <h1 style={{ margin: 0, fontSize: 26, letterSpacing: -0.4, fontWeight: 600 }}>{t('welcome.title')}</h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)', maxWidth: 520 }}>{t('welcome.body')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {cards.map(([num, title, desc]) => (
            <Spotlight key={title} style={{ padding: 14, background: 'rgba(255,255,255,.04)' }}>
              <div style={{ fontSize: 11, color: 'var(--dim)', fontVariantNumeric: 'tabular-nums' }}>{num}</div>
              <div style={{ fontWeight: 600, fontSize: 14, margin: '6px 0 4px' }}>{t(title as any)}</div>
              <div style={{ color: 'var(--dim)', fontSize: 12 }}>{t(desc as any)}</div>
            </Spotlight>
          ))}
        </div>
        <p style={{ margin: 0, color: 'var(--dim)' }}>{t('welcome.step1')} <Kbd>⌘K</Kbd></p>
        <div style={{ borderTop: '1px solid var(--line)', paddingTop: 14, color: 'var(--dim)' }}>{t('welcome.telemetry')}</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className={`btn ${consent === 'granted' ? 'primary' : ''}`} onClick={() => void window.izlix.setSettings({ telemetry: 'granted' })}>{t('welcome.allow')}</button>
          <button className={`btn ${consent === 'denied' ? 'primary' : ''}`} onClick={() => void window.izlix.setSettings({ telemetry: 'denied' })}>{t('welcome.deny')}</button>
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={finish}>{t('welcome.skip')}</button>
          <button className="btn primary" style={{ padding: '6px 18px' }} onClick={() => void demo()}>{t('welcome.demo')}</button>
        </div>
      </div>
    </div>
  )
}
