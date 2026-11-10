import { useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Sade yardimci bilesenler: hover'da hafifce belirginlesen kart ve tus etiketi.

/** Hover'da hafifce belirginlesen kart */
export function Spotlight({ children, className = '', onClick, style, selected }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties; selected?: boolean }) {
  return <div className={`spot ${selected ? 'sel' : ''} ${className}`} onClick={onClick} style={style}>{children}</div>
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>

/** Kayan gostergeli segmentli kontrol: secili sekmenin arkasindaki hap yumusakca yer degistirir. */
export function Seg<T extends string>({ items, value, onChange, small }: { items: { key: T; label: ReactNode }[]; value: T; onChange(k: T): void; small?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [ind, setInd] = useState<{ left: number; width: number } | null>(null)
  useLayoutEffect(() => {
    const el = ref.current?.querySelector<HTMLElement>('[data-on="1"]')
    if (el) setInd({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, items.length, items.map((i) => (typeof i.label === 'string' ? i.label : '')).join('|')])
  return (
    <div ref={ref} className={`seg2 ${small ? 'sm' : ''}`} role="tablist">
      {ind && <i className="seg-ind" style={{ transform: `translateX(${ind.left}px)`, width: ind.width }} />}
      {items.map((i) => <button key={i.key} role="tab" aria-selected={i.key === value} data-on={i.key === value ? '1' : '0'} className={i.key === value ? 'on' : ''} onClick={() => onChange(i.key)}>{i.label}</button>)}
    </div>
  )
}
