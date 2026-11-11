import { ENGINES } from '../shared/search'
import { useEffect, useState } from 'react'
import type { DevToolsDock, Editor, Language } from '../shared/events'
import { useStore, useT, writePref } from './store'
import { Kbd } from './ui'

function Switch({ on, onChange, label }: { on: boolean; onChange(v: boolean): void; label: string }) {
  return <button type="button" role="switch" aria-checked={on} aria-label={label} className={`switch ${on ? 'on' : ''}`} onClick={() => onChange(!on)}><i /></button>
}

/** Ayarlar (⌘,): dil, editor, telemetri, otomatik sekme, DevTools yerlesimi. */
export function Settings({ onClose }: { onClose(): void }) {
  const t = useT()
  const settings = useStore((s) => s.settings)
  const editor = useStore((s) => s.editor)
  const dock = useStore((s) => s.dock)
  const set = useStore((s) => s.set)
  const api = window.izlix
  const [perms, setPerms] = useState<{ origin: string; permission: string; decision: string }[]>([])
  const loadPerms = (): void => { void api.permList().then((l: any) => setPerms(l ?? [])) }
  useEffect(loadPerms, [])
  const Row = ({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) => (
    <div className="srow"><div><div className="stitle">{title}</div>{hint && <div className="shint">{hint}</div>}</div><div>{children}</div></div>
  )
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('set.title')} style={{ width: 'min(560px, 92vw)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}><b style={{ flex: 1, fontSize: 14 }}>{t('set.title')}</b><Kbd>⌘,</Kbd></div>
        <div style={{ overflow: 'auto', padding: '4px 18px 14px' }}>
          <Row title={t('set.language')}>
            <select value={settings.language} onChange={(e) => void api.setSettings({ language: e.target.value as Language })}><option value="en">English</option><option value="tr">Türkçe</option></select>
          </Row>
          <Row title={t('set.search')} hint={t('set.searchHint')}>
            <select value={settings.searchEngine ?? 'duckduckgo'} onChange={(e) => void api.setSettings({ searchEngine: e.target.value })}>{ENGINES.map((e) => <option key={e.id} value={e.id}>{e.label}</option>)}</select>
          </Row>
          <Row title={t('set.editor')} hint={t('set.editorHint')}>
            <select value={editor} onChange={(e) => { writePref('editor', e.target.value); set({ editor: e.target.value as Editor }) }}><option value="vscode">VS Code</option><option value="cursor">Cursor</option><option value="webstorm">WebStorm</option></select>
          </Row>
          <Row title={t('set.dock')} hint={t('set.dockHint')}>
            <select value={dock} onChange={(e) => { writePref('dock', e.target.value); set({ dock: e.target.value as DevToolsDock }) }}><option value="off">{t('dock.off')}</option><option value="right">{t('dock.right')}</option><option value="bottom">{t('dock.bottom')}</option></select>
          </Row>
          <Row title={t('set.autoOpen')} hint={t('set.autoOpenHint')}><Switch on={settings.autoOpen} label={t('set.autoOpen')} onChange={(v) => void api.setSettings({ autoOpen: v })} /></Row>
          <Row title={t('set.telemetry')} hint={t('set.telemetryHint')}><Switch on={settings.telemetry === 'granted'} label={t('set.telemetry')} onChange={(v) => void api.setSettings({ telemetry: v ? 'granted' : 'denied' })} /></Row>
          <div className="srow" style={{ display: 'block' }}>
            <div className="stitle" style={{ marginBottom: 6 }}>{t('set.perms')}</div>
            {perms.map((p) => (
              <div key={p.origin + p.permission} className="permrow"><span>{p.origin}</span><code>{p.permission}</code><em className={p.decision}>{p.decision}</em>
                <button className="link" onClick={() => void api.permRemove(p.origin, p.permission).then(loadPerms)}>{t('set.permRevoke')}</button></div>
            ))}
            {!perms.length && <div className="shint">{t('set.permsEmpty')}</div>}
          </div>
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid var(--line)', display: 'flex', justifyContent: 'flex-end' }}><button className="btn primary" onClick={onClose}>{t('welcome.done')}</button></div>
      </div>
    </div>
  )
}
