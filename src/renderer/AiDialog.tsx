import { useEffect, useState } from 'react'
import { useStore, useT } from './store'
import { Kbd } from './ui'

type Preview = { prompt: string; provider: string; model: string; target: string; needsKey: boolean; hasKey: boolean; empty: boolean }

/** AI ile acikla: GONDERILECEK metni ve hedefi gosterir; kullanici "Gonder"e basmadan hicbir sey cikmaz. Metin duzenlenebilir. */
export function AiDialog({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const focus = useStore((s) => s.aiFocus)
  const [pv, setPv] = useState<Preview | null>(null)
  const [prompt, setPrompt] = useState('')
  const [state, setState] = useState<'preview' | 'sending' | 'done' | 'error'>('preview')
  const [answer, setAnswer] = useState('')
  useEffect(() => { void api.aiPreview(focus).then((p: Preview) => { setPv(p); setPrompt(p.prompt) }) }, [])
  const send = (): void => {
    setState('sending')
    void api.aiAsk(prompt).then((r: { ok: boolean; text?: string; error?: string; detail?: string }) => { if (r.ok) { setAnswer(r.text ?? ''); setState('done') } else { setAnswer(t(`ai.err.${r.error}` as any) + (r.detail ? `\n${r.detail}` : '')); setState('error') } })
  }
  if (!pv) return null
  const local = pv.provider === 'ollama' && /127\.0\.0\.1|localhost/.test(pv.target)
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog ai" role="dialog" aria-label={t('ai.title')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('ai.title')}</b><span className={`ai-target ${local ? 'local' : 'remote'}`}>{local ? t('ai.local') : t('ai.remote', { t: pv.target.replace(/^https?:\/\//, '') })} · {pv.model}</span><span style={{ flex: 1 }} /><Kbd>esc</Kbd></div>
        {state === 'preview' && <div className="ai-body">
          <div className="shint">{t('ai.willSend')}</div>
          <textarea className="ai-prompt" value={prompt} spellCheck={false} onChange={(e) => setPrompt(e.target.value)} />
          {pv.empty && <div className="shint" style={{ color: 'var(--warn, #f5b94a)' }}>{t('ai.nothing')}</div>}
          {pv.needsKey && !pv.hasKey && <div className="shint" style={{ color: 'var(--warn, #f5b94a)' }}>{t('ai.noKey')}</div>}
          <div style={{ display: 'flex', gap: 8 }}><button className="btn primary" disabled={!prompt.trim() || (pv.needsKey && !pv.hasKey)} onClick={send}>{t('ai.send')}</button><button className="btn" onClick={onClose}>{t('dlg.cancel')}</button></div>
        </div>}
        {state === 'sending' && <div className="ai-body"><div className="skeleton" style={{ height: 80 }} /><div className="shint">{t('ai.waiting')}</div></div>}
        {(state === 'done' || state === 'error') && <div className="ai-body"><div className={`ai-answer ${state}`}>{answer}</div><div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => void navigator.clipboard.writeText(answer)}>{t('qr.copy')}</button><button className="btn" onClick={() => setState('preview')}>{t('ai.back')}</button></div></div>}
      </div>
    </div>
  )
}
