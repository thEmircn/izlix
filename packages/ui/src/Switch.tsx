import s from './Switch.module.css'
import { cx } from './cx'

/** Acma/kapama anahtari (role=switch): yayli dugme hareketi, basili tutunca uzar. */
export function Switch({ on, onChange, label, disabled }: { on: boolean; onChange(v: boolean): void; label: string; disabled?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} disabled={disabled} className={cx(s.sw, on && s.on)} onClick={() => onChange(!on)}>
      <span className={s.knob} />
    </button>
  )
}
