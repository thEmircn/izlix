import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

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

/** Sayi degisince eski degerden yenisine akan sayac (reduced-motion'da aninda). */
export function CountUp({ value, decimals = 0, ms = 600 }: { value: number; decimals?: number; ms?: number }) {
  const [shown, setShown] = useState(value)
  const from = useRef(value)
  useEffect(() => {
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reduce || from.current === value) { setShown(value); from.current = value; return }
    const a = from.current, t0 = performance.now()
    let raf = 0
    const step = (t: number): void => {
      const k = Math.min(1, (t - t0) / ms), e = 1 - Math.pow(1 - k, 3)
      setShown(a + (value - a) * e)
      if (k < 1) raf = requestAnimationFrame(step); else from.current = value
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [value, ms])
  return <>{shown.toFixed(decimals)}</>
}

/** Kucuk cizgi grafigi (son degerler). Reduced-motion disinda cizgi giriste cizilir. */
export function Spark({ values, color = '#d4d4d8', height = 36 }: { values: number[]; color?: string; height?: number }) {
  const w = 160
  if (values.length < 2) return <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} />
  const lo = Math.min(...values), hi = Math.max(...values), span = hi - lo || 1
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${height - 3 - ((v - lo) / span) * (height - 8)}`)
  return (
    <svg width="100%" height={height} viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="spark">
      <polyline points={`0,${height} ${pts.join(' ')} ${w},${height}`} fill={color} fillOpacity=".08" stroke="none" />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}
