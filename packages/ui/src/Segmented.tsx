import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import s from './Segmented.module.css'
import { cx } from './cx'

export interface SegmentedProps<T extends string> { items: { key: T; label: ReactNode }[]; value: T; onChange(k: T): void; small?: boolean; label?: string }

/** Segmentli secici: secili ogenin altinda yayli kayan gosterge; ok tuslariyla gezilir (role=tablist). */
export function Segmented<T extends string>({ items, value, onChange, small, label }: SegmentedProps<T>) {
  const root = useRef<HTMLDivElement>(null)
  const [box, setBox] = useState<{ x: number; w: number } | null>(null)
  useLayoutEffect(() => {
    const el = root.current?.querySelector<HTMLElement>('[aria-selected="true"]')
    if (el) setBox({ x: el.offsetLeft, w: el.offsetWidth })
  }, [value, items.length])
  const move = (dir: number): void => { const i = items.findIndex((x) => x.key === value); const n = items[(i + dir + items.length) % items.length]; onChange(n.key) }
  return (
    <div ref={root} role="tablist" aria-label={label} className={cx(s.seg, small && s.sm)} onKeyDown={(e) => { if (e.key === 'ArrowRight') { e.preventDefault(); move(1) } else if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1) } }}>
      {box && <span className={s.indicator} style={{ width: box.w, transform: `translateX(${box.x}px)` }} />}
      {items.map((it) => (
        <button key={it.key} type="button" role="tab" aria-selected={it.key === value} tabIndex={it.key === value ? 0 : -1} className={s.item} onClick={() => onChange(it.key)}>{it.label}</button>
      ))}
    </div>
  )
}
