import { useMemo, useState } from 'react'
import { toPlaywright, tidySteps, locator, type Step } from '../shared/recorder'
import { useStore, useT, toast } from './store'
import { Kbd } from './ui'

const label = (s: Step): string => s.t === 'goto' ? `goto  ${s.url}` : s.t === 'click' ? `click  ${locator(s.sel).replace('page.', '')}` : s.t === 'fill' ? `fill  ${locator(s.sel).replace('page.', '')}  ${s.secret ? '••••' : JSON.stringify(s.value)}` : s.t === 'select' ? `select  ${locator(s.sel).replace('page.', '')}  ${JSON.stringify(s.value)}` : `press  ${s.key}  ${locator(s.sel).replace('page.', '')}`

/** Recorder sonucu: adimlar + Playwright test kodu; kopyala / dosyaya kaydet. */
export function RecorderDialog({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const steps = useStore((s) => s.rec.steps)
  const [name, setName] = useState('recorded flow')
  const replay = useStore((s) => s.replay)
  const play = (): void => {
    useStore.setState({ replay: { running: true, states: {}, summary: '' }, overlay: null }) // oynatma sirasinda sayfa gorunur olsun
    void api.recReplay(tidySteps(steps)).then((r: { ok: number; fail: number; skipped: number; error?: string }) => useStore.setState({ replay: { running: false, states: useStore.getState().replay.states, summary: r.fail ? t('rec.replayFail', { n: r.fail, e: r.error ?? '' }) : t('rec.replayOk', { n: r.ok, s: r.skipped }) }, overlay: 'recorder' }))
  }
  const tidy = useMemo(() => tidySteps(steps), [steps])
  const code = useMemo(() => toPlaywright(steps, name), [steps, name])
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog rec" role="dialog" aria-label={t('rec.title')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('rec.title')}</b><input value={name} spellCheck={false} placeholder={t('rec.name')} onChange={(e) => setName(e.target.value)} /><Kbd>esc</Kbd></div>
        <div className="rec-main">
          <div className="rec-steps">{tidy.length === 0 ? <div className="hub-empty">{t('rec.empty')}</div> : tidy.map((s, i) => <div key={i} className={`rec-step st-${replay.states[i] ?? ''}`}><em>{replay.states[i] === 'ok' ? '✓' : replay.states[i] === 'fail' ? '✗' : replay.states[i] === 'skip' ? '–' : replay.states[i] === 'run' ? '…' : i + 1}</em><code>{label(s)}</code></div>)}</div>
          <textarea className="rec-code" readOnly spellCheck={false} value={code} />
        </div>
        <div className="rec-foot">
          {replay.running ? <button className="btn" onClick={() => void api.recReplayStop()}>{t('rec.stopReplay')}</button> : <button className="btn primary" disabled={!tidy.length} onClick={play}>{t('rec.play')}</button>}
          <button className="btn" onClick={() => void navigator.clipboard.writeText(code).then(() => toast(t('qr.copied')))}>{t('rec.copy')}</button>
          <button className="btn" onClick={() => void api.recSave(code, name).then((f: string | null) => { if (f) toast(t('print.saved')) })}>{t('rec.save')}</button>
          <span style={{ flex: 1 }} /><span className="shint">{replay.summary || t('rec.note')}</span>
        </div>
      </div>
    </div>
  )
}
