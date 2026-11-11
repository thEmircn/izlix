import type { ReactNode } from 'react'
import s from './Chip.module.css'
import { cx } from './cx'

/** Hap etiket: tiklanabilir (onClick verilirse buton) ya da salt gosterim; secili durum ve sayac. */
export function Chip({ children, on, count, onClick, title }: { children: ReactNode; on?: boolean; count?: number | string; onClick?: () => void; title?: string }) {
  const body = <>{children}{count !== undefined && <span className={s.count}>{count}</span>}</>
  return onClick
    ? <button type="button" title={title} aria-pressed={on} className={cx(s.chip, on && s.on)} onClick={onClick}>{body}</button>
    : <span title={title} className={cx(s.chip, on && s.on)}>{body}</span>
}
