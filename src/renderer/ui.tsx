import { useRef, type CSSProperties, type ReactNode } from 'react'

// Kucuk, orijinal gorsel bilesen seti (bagimliliksiz): parlayan metin, fare izleyen isik kartı, aurora arka plan, tus etiketi.
// Animasyonlar CSS'tedir ve `prefers-reduced-motion` altinda kapanir.

/** Metin uzerinde gezinen parlak bir bant */
export function ShinyText({ children, style }: { children: ReactNode; style?: CSSProperties }) {
  return <span className="shiny" style={style}>{children}</span>
}

/** Fare konumunu izleyen yumusak bir isik lekesi olan kart/oge. `as` ile div/button olabilir. */
export function Spotlight({ children, className = '', onClick, style, selected }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties; selected?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const move = (e: React.MouseEvent): void => {
    const r = ref.current?.getBoundingClientRect()
    if (!r || !ref.current) return
    ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
    ref.current.style.setProperty('--my', `${e.clientY - r.top}px`)
  }
  return <div ref={ref} className={`spot ${selected ? 'sel' : ''} ${className}`} onMouseMove={move} onClick={onClick} style={style}>{children}</div>
}

/** Yavasca akan renkli bulaniklastirilmis lekelerden olusan arka plan */
export function Aurora() {
  return <div className="aurora" aria-hidden><i /><i /><i /></div>
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>
