import { useEffect, useRef, useState, type ReactNode } from 'react'
import s from './Dialog.module.css'

/** open=false oldugunda cikis animasyonu bitene kadar mount'ta kalir */
function useMounted(open: boolean, ms: number): [boolean, 'open' | 'closed'] {
  const [mounted, setMounted] = useState(open)
  useEffect(() => {
    if (open) { setMounted(true); return }
    const t = setTimeout(() => setMounted(false), ms); return () => clearTimeout(t)
  }, [open, ms])
  return [mounted || open, open ? 'open' : 'closed']
}

export interface DialogProps {
  open: boolean; onClose(): void; title: string; children: ReactNode
  /** alt cubuk (genelde Button'lar) */
  footer?: ReactNode
  /** panel genisligi px */
  width?: number
  /** rol: onay/uyari icin alertdialog */
  role?: 'dialog' | 'alertdialog'
  /** katman sirasi (varsayilan 60) */
  zIndex?: number
}

/** Modal: bulaniklastirilmis arka plan, yayli giris/cikis, Esc ile ve disina tiklayarak kapanir, odak icerige tasinir ve kapaninca geri doner. */
export function Dialog({ open, onClose, title, children, footer, width = 520, role = 'dialog', zIndex = 60 }: DialogProps) {
  const [shown, state] = useMounted(open, 140)
  const panel = useRef<HTMLDivElement>(null), prev = useRef<Element | null>(null)
  useEffect(() => {
    if (!open) return
    prev.current = document.activeElement
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus], input, button:not([data-close]), [href], select, textarea') ?? panel.current
    first?.focus()
    const onKey = (e: KeyboardEvent): void => { if (e.key === 'Escape') { e.stopPropagation(); onClose() } }
    document.addEventListener('keydown', onKey, true)
    return () => { document.removeEventListener('keydown', onKey, true); (prev.current as HTMLElement | null)?.focus?.() }
  }, [open, onClose])
  if (!shown) return null
  return (
    <div className={s.overlay} data-state={state} style={{ zIndex }} onMouseDown={onClose}>
      <div ref={panel} className={s.panel} role={role} aria-modal="true" aria-label={title} tabIndex={-1} style={{ ['--dlg-w' as string]: `${width}px` }} onMouseDown={(e) => e.stopPropagation()}>
        <div className={s.head}>
          <h2 className={s.title}>{title}</h2>
          <button type="button" data-close className={s.close} aria-label="Close" onClick={onClose}>
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"><path d="M3 3l8 8M11 3l-8 8" /></svg>
          </button>
        </div>
        <div className={s.body}>{children}</div>
        {footer && <div className={s.foot}>{footer}</div>}
      </div>
    </div>
  )
}
