import { useEffect, useMemo, useRef, useState } from 'react'
import { rank } from '../shared/fuzzy'
import { buildCommands } from './commands'
import { useStore, useT, tNow } from './store'
import { Kbd } from './ui'
import { boost, record, type Usage } from '../shared/frecency'

/** Command Palette (⌘K): tüm eylemler, sekmeler, Workspace'ler. Hedef: sonuç < 50 ms. */
export function Palette({ onClose }: { onClose(): void }) {
  const t = useT()
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const [hist, setHist] = useState<{ url: string; title: string }[]>([])
  useEffect(() => { void window.izlix.history().then((h: any) => setHist(h ?? [])) }, [])
  const all = useMemo(() => [
    ...buildCommands(),
    ...hist.map((h) => ({ id: `hist:${h.url}`, title: tNow('cmd.history', { t: h.title }), hint: h.url, run: () => { useStore.getState().set({ overlay: null }); void window.izlix.createTab(h.url) } }))
  ], [hist])
  const usage = useMemo<Usage>(() => { try { return JSON.parse(localStorage.getItem('cmdUsage') ?? '{}') } catch { return {} } }, [])
  const shown = useMemo(() => boost(rank(all, q, (c) => c.title + ' ' + (c.hint ?? ''), 50), usage, q), [all, q, usage])
  const run = (c: { id: string; run(): void }): void => { try { localStorage.setItem('cmdUsage', JSON.stringify(record(usage, c.id))) } catch { /* yok say */ } c.run() }
  const list = useRef<HTMLDivElement>(null)
  useEffect(() => setSel(0), [q])
  useEffect(() => { (list.current?.children[sel] as HTMLElement | undefined)?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const key = (e: React.KeyboardEvent): void => {
    if (e.key === 'Escape') onClose()
    else if (e.key === 'ArrowDown') { e.preventDefault(); setSel((i) => Math.min(i + 1, shown.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel((i) => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (shown[sel]) run(shown[sel]) }
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label="Command Palette" onMouseDown={(e) => e.stopPropagation()} onKeyDown={key}>
        <input className="pal-input" autoFocus placeholder={t('pal.placeholder')} value={q} onChange={(e) => setQ(e.target.value)} />
        <div className="pal-list" ref={list} role="listbox">
          {shown.map((c, i) => (
            <div key={c.id} role="option" aria-selected={i === sel} className={`pal-item ${i === sel ? 'sel' : ''}`} onMouseMove={() => setSel(i)} onClick={() => run(c)}>
              <span>{c.title}</span><span className="hint">{c.hint && /^[⌘⇧⌥⌃]/.test(c.hint) ? <Kbd>{c.hint}</Kbd> : c.hint}</span>
            </div>
          ))}
          {!shown.length && <div style={{ padding: 14, color: 'var(--dim)' }}>{t('pal.none')}</div>}
        </div>
      </div>
    </div>
  )
}
