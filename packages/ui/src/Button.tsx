import type { ButtonHTMLAttributes, ReactNode } from 'react'
import s from './Button.module.css'
import { cx } from './cx'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: 'default' | 'primary' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  /** yukleniyor: dugme devre disi, donen gosterge */
  loading?: boolean
  children?: ReactNode
  className?: string
}

/** Dugme: yayli basma, odak halkasi, 4 gorunum, 3 boyut. */
export function Button({ variant = 'default', size = 'md', loading, disabled, className, children, type = 'button', ...rest }: ButtonProps) {
  return (
    <button type={type} disabled={disabled || loading} aria-busy={loading || undefined} className={cx(s.btn, variant !== 'default' && s[variant], size !== 'md' && s[size], className)} {...rest}>
      {loading && <span className={s.spinner} aria-hidden="true" />}
      {children}
    </button>
  )
}
