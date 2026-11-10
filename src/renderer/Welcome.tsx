import { useStore, useT } from './store'
import { Aurora, Kbd, ShinyText, Spotlight } from './ui'

/** İlk açılış: değer vaadi, demo ve telemetri izni (varsayılan: izin yok, hiçbir şey gönderilmez). */
export function Welcome({ onClose }: { onClose(): void }) {
  const t = useT()
  const consent = useStore((s) => s.settings.telemetry)
  const finish = (): void => { void window.izlix.setSettings({ onboarded: true }); onClose() }
  const demo = async (): Promise<void> => { finish(); await window.izlix.openDemo() }
  const cards: [string, string, string, string][] = [['👁', 'welcome.see', 'welcome.seeD', '#8b5cf6'], ['⌖', 'welcome.find', 'welcome.findD', '#22d3ee'], ['⚡', 'welcome.change', 'welcome.changeD', '#fbbf24']]
  return (
    <div className="overlay" style={{ paddingTop: '8vh' }}>
      <div className="dialog welcome" role="dialog" aria-label={t('welcome.title')} style={{ width: 'min(680px, 94vw)', padding: 28, gap: 18 }}>
        <Aurora />
        <h1 style={{ margin: 0, fontSize: 28, letterSpacing: -0.5 }}><ShinyText>{t('welcome.title')}</ShinyText></h1>
        <p style={{ margin: 0, fontSize: 14, color: 'var(--dim)', maxWidth: 520 }}>{t('welcome.body')}</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {cards.map(([icon, title, desc, color]) => (
            <Spotlight key={title} style={{ padding: 14, background: 'rgba(255,255,255,.04)' }}>
              <div style={{ fontSize: 20, color, textShadow: `0 0 16px ${color}` }}>{icon}</div>
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
          <button className="btn primary" style={{ padding: '6px 18px' }} onClick={() => void demo()}>{t('welcome.demo')} →</button>
        </div>
      </div>
    </div>
  )
}
