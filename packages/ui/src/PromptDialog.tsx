import { Button } from './Button'
import { Dialog } from './Dialog'
import { Field } from './Field'

export interface PromptDialogProps {
  title: string; value: string; onChange(v: string): void
  placeholder?: string; maxLength?: number
  confirmLabel: string; cancelLabel: string
  /** Enter veya onay dugmesi */
  onConfirm(): void; onClose(): void
}

/** Tek satir metin isteyen kucuk modal (ad ver, not ekle...): Dialog + Field + iki Button; Enter onaylar, Esc iptal. */
export function PromptDialog({ title, value, onChange, placeholder, maxLength, confirmLabel, cancelLabel, onConfirm, onClose }: PromptDialogProps) {
  return (
    <Dialog open title={title} width={420} onClose={onClose}
      footer={<><Button onClick={onClose}>{cancelLabel}</Button><Button variant="primary" onClick={onConfirm}>{confirmLabel}</Button></>}>
      <Field data-autofocus aria-label={title} value={value} maxLength={maxLength} placeholder={placeholder} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); onConfirm() } }} />
    </Dialog>
  )
}
