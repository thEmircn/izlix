import { useId, type InputHTMLAttributes } from 'react'
import s from './Field.module.css'
import { cx } from './cx'

export interface FieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> {
  label?: string; hint?: string; error?: string; className?: string
}

/** Metin alani: etiket, ipucu, hata; odakta vurgu halkasi. Etiket ve hata erisilebilir sekilde baglanir. */
export function Field({ label, hint, error, className, id, ...rest }: FieldProps) {
  const auto = useId(), fid = id ?? auto, desc = error ? `${fid}-e` : hint ? `${fid}-h` : undefined
  return (
    <div className={cx(s.wrap, className)}>
      {label && <label className={s.label} htmlFor={fid}>{label}</label>}
      <input id={fid} className={s.input} aria-invalid={error ? true : undefined} aria-describedby={desc} {...rest} />
      {error ? <span id={`${fid}-e`} className={s.error} role="alert">{error}</span> : hint ? <span id={`${fid}-h`} className={s.hint}>{hint}</span> : null}
    </div>
  )
}
