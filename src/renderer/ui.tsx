import { K } from './platform'
import { Children, isValidElement, useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react'

// Sade yardimci bilesenler: hover'da hafifce belirginlesen kart ve tus etiketi.

/** Hover'da hafifce belirginlesen kart */
export function Spotlight({ children, className = '', onClick, style, selected }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties; selected?: boolean }) {
  return <div className={`spot ${selected ? 'sel' : ''} ${className}`} onClick={onClick} style={style}>{children}</div>
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{typeof children === 'string' ? K(children) : children}</kbd>

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

const reduceMotion = (): boolean => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches

/** Tek rakam makarasi: 0-9 dikey seritte; rakam degisince seridi her zaman ILERI dondurur (analog sayac / kilometre sayaci gibi). */
function RollDigit({ d }: { d: number }) {
  const [idx, setIdx] = useState(d)      // seritteki konum 0..18 (dinlenirken 0..9)
  const [snap, setSnap] = useState(false) // 10'u gecince animasyonsuz geri sar
  const cur = useRef(d)
  useEffect(() => {
    if (cur.current === d) return
    if (reduceMotion()) { cur.current = d; setSnap(true); setIdx(d); return }
    const steps = (d - cur.current + 10) % 10
    cur.current = d; setSnap(false); setIdx((i) => (i % 10) + steps)
  }, [d])
  const done = (): void => { if (idx >= 10) { setSnap(true); setIdx(idx % 10) } }
  useEffect(() => { if (snap) { const r = requestAnimationFrame(() => requestAnimationFrame(() => setSnap(false))); return () => cancelAnimationFrame(r) } }, [snap])
  return (
    <span className="roll-d" aria-hidden="true">
      <span className={`roll-strip ${snap ? 'snap' : ''}`} style={{ transform: `translateY(calc(${idx} * -1.18em))` }} onTransitionEnd={done} />
      <span className="roll-ghost">{d}</span>
    </span>
  )
}

/** Metindeki rakamlar dondurulerek degisir (analog saat gibi); diger karakterler sabit. Genislik rakamlari sabit tutar. */
export function Roll({ text, className }: { text: string | number; className?: string }) {
  const s = String(text)
  return (
    <span className={`roll ${className ?? ''}`} role="text" aria-label={s}>
      {[...s].map((ch, i) => (/\d/.test(ch) ? <RollDigit key={s.length - i} d={Number(ch)} /> : <span key={`c${s.length - i}`} className="roll-ch">{ch}</span>))}
    </span>
  )
}

/** Eski ad: sayi degisince rakamlar doner. */
export function CountUp({ value, decimals = 0 }: { value: number; decimals?: number; ms?: number }) {
  return <Roll text={value.toFixed(decimals)} />
}

function useWidth(): [React.RefObject<HTMLDivElement | null>, number] {
  const ref = useRef<HTMLDivElement>(null)
  const [w, setW] = useState(160)
  useLayoutEffect(() => {
    const el = ref.current; if (!el) return
    const ro = new ResizeObserver(() => setW(Math.max(40, el.clientWidth))); ro.observe(el); setW(Math.max(40, el.clientWidth))
    return () => ro.disconnect()
  }, [])
  return [ref, w]
}

/** Egrisel alan grafigi: cizgi giriste cizilir, alan solar, son nokta nabiz atar, imlec en yakin degeri gosterir. */
export function Spark({ values, color = 'var(--ac)', height = 40, format }: { values: number[]; color?: string; height?: number; format?: (v: number) => string }) {
  const [ref, w] = useWidth()
  const id = useId().replace(/:/g, '')
  const [hover, setHover] = useState<number | null>(null)
  const n = values.length
  const lo = Math.min(0, ...values), hi = Math.max(1, ...values), span = hi - lo || 1
  const pad = 4
  const X = (i: number): number => (n < 2 ? 0 : (i / (n - 1)) * (w - 2 * pad) + pad)
  const Y = (v: number): number => height - pad - ((v - lo) / span) * (height - 2 * pad - 2)
  let d = ''
  if (n >= 2) {
    d = `M${X(0)},${Y(values[0])}`
    for (let i = 0; i < n - 1; i++) { const x0 = X(i), y0 = Y(values[i]), x1 = X(i + 1), y1 = Y(values[i + 1]), cx = (x0 + x1) / 2; d += ` C${cx},${y0} ${cx},${y1} ${x1},${y1}` }
  }
  const last = n ? { x: X(n - 1), y: Y(values[n - 1]) } : null
  const hv = hover != null && n ? { x: X(hover), y: Y(values[hover]), v: values[hover] } : null
  return (
    <div ref={ref} className="spark" style={{ height, color }}
      onMouseMove={(e) => { if (n < 2) return; const r = e.currentTarget.getBoundingClientRect(); setHover(Math.max(0, Math.min(n - 1, Math.round(((e.clientX - r.left - pad) / (w - 2 * pad)) * (n - 1))))) }}
      onMouseLeave={() => setHover(null)}>
      <svg width={w} height={height}>
        <defs><linearGradient id={id} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="currentColor" stopOpacity=".28" /><stop offset="1" stopColor="currentColor" stopOpacity="0" /></linearGradient></defs>
        {[0.25, 0.5, 0.75].map((f) => <line key={f} x1={0} x2={w} y1={height * f} y2={height * f} className="spark-grid" />)}
        {n >= 2 && <><path d={`${d} L${X(n - 1)},${height} L${X(0)},${height} Z`} fill={`url(#${id})`} className="spark-area" />
          <path d={d} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" pathLength={1} className="spark-line" /></>}
        {last && !hv && <><circle cx={last.x} cy={last.y} r="7" fill="currentColor" opacity=".18" className="spark-ping" /><circle cx={last.x} cy={last.y} r="2.6" fill="currentColor" className="spark-dot" /></>}
        {hv && <><line x1={hv.x} x2={hv.x} y1={0} y2={height} className="spark-cur" /><circle cx={hv.x} cy={hv.y} r="3.4" fill="var(--bg)" stroke="currentColor" strokeWidth="1.8" /></>}
      </svg>
      {hv && <div className="spark-tip" style={{ left: Math.min(w - 54, Math.max(0, hv.x - 24)) }}>{format ? format(hv.v) : hv.v}</div>}
    </div>
  )
}

/** Animasyonlu sutun grafigi: sutunlar sirayla buyur; hata kismi ustte kirmizi yigilir. */
export function Bars({ values, bad = [], height = 84, labels }: { values: number[]; bad?: number[]; height?: number; labels?: [string, string] }) {
  const hi = Math.max(1, ...values)
  return (
    <div className="bars-wrap">
      <div className="bars" style={{ height }}>
        {values.map((v, i) => {
          const b = Math.min(v, bad[i] ?? 0), h = (v / hi) * 100
          return (
            <div key={i} className={`bar ${v ? '' : 'zero'}`} style={{ ['--i' as any]: i }} title={`${v}${b ? ` (${b} !)` : ''}`}>
              <i style={{ height: v ? `${Math.max(h, 6)}%` : '3px' }}>{b > 0 && <u style={{ height: `${(b / v) * 100}%` }} />}</i>
            </div>
          )
        })}
      </div>
      {labels && <div className="bars-axis"><span>{labels[0]}</span><span>{labels[1]}</span></div>}
    </div>
  )
}

/** Halka grafik: dilimler soldan saat yonunde suzulerek dolar; ortada serbest icerik. */
export function Donut({ segments, size = 104, thickness = 11, children }: { segments: { value: number; color: string; label: string }[]; size?: number; thickness?: number; children?: ReactNode }) {
  const r = (size - thickness) / 2, C = 2 * Math.PI * r
  const total = segments.reduce((a, x) => a + x.value, 0) || 1
  const [on, setOn] = useState(false)
  useEffect(() => { const h = requestAnimationFrame(() => setOn(true)); return () => cancelAnimationFrame(h) }, [])
  let acc = 0
  return (
    <div className="donut" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,.06)" strokeWidth={thickness} />
        {segments.filter((x) => x.value > 0).map((x, i) => {
          const len = Math.max(0, (x.value / total) * C - 2), off = acc; acc += (x.value / total) * C
          return <circle key={x.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={x.color} strokeWidth={thickness} strokeLinecap="round" transform={`rotate(-90 ${size / 2} ${size / 2})`}
            strokeDasharray={`${on ? len : 0} ${C}`} strokeDashoffset={-off} style={{ transition: `stroke-dasharray .9s var(--ease) ${i * 90}ms` }}><title>{x.label}</title></circle>
        })}
      </svg>
      <div className="donut-c">{children}</div>
    </div>
  )
}

export interface MenuItem { label?: string; run?: () => void; danger?: boolean; sep?: boolean; hint?: string }
/** Imlecin yaninda acilan cam baglam menusu: disari tiklayinca / Esc / kaydirmada kapanir; kenarlara tasmaz. */
export function ContextMenu({ x, y, items, onClose }: { x: number; y: number; items: MenuItem[]; onClose(): void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [pos, setPos] = useState({ x, y })
  useLayoutEffect(() => { const r = ref.current?.getBoundingClientRect(); if (r) setPos({ x: Math.max(6, Math.min(x, window.innerWidth - r.width - 8)), y: Math.max(6, Math.min(y, window.innerHeight - r.height - 8)) }) }, [x, y])
  useEffect(() => {
    const close = (): void => onClose()
    const key = (e: KeyboardEvent): void => { if (e.key === 'Escape') onClose() }
    window.addEventListener('pointerdown', close, true); window.addEventListener('keydown', key); window.addEventListener('blur', close); window.addEventListener('wheel', close, { passive: true })
    return () => { window.removeEventListener('pointerdown', close, true); window.removeEventListener('keydown', key); window.removeEventListener('blur', close); window.removeEventListener('wheel', close) }
  }, [onClose])
  return (
    <div ref={ref} className="ctxmenu" style={{ left: pos.x, top: pos.y }} role="menu" onPointerDown={(e) => e.stopPropagation()}>
      {items.map((it, i) => it.sep ? <i key={i} className="ctx-sep" /> : (
        <button key={i} role="menuitem" className={`ctx-item ${it.danger ? 'bad' : ''}`} onClick={() => { it.run?.(); onClose() }}>{it.label}{it.hint && <kbd>{it.hint}</kbd>}</button>
      ))}
    </div>
  )
}

/** Site ikonu varsa gosterir, yoksa harf avatarini (children) */
export function Fav({ icon, children }: { icon?: string; children: React.ReactNode }): React.ReactElement {
  return icon ? <img className="fav-img" alt="" src={icon} draggable={false} /> : <>{children}</>
}

/** <select> yerine macOS'un yerel acilir menusu (NSMenu). Ayni arayuz: value/onChange(e.target.value)/<option>. Yerel menu yoksa (eklenti, onizleme) normal select. */
export function Select({ value, onChange, children, className, style, disabled, title, 'aria-label': ariaLabel }: { value: string | number; onChange(e: { target: { value: string } }): void; children: ReactNode; className?: string; style?: CSSProperties; disabled?: boolean; title?: string; 'aria-label'?: string }) {
  const opts: { value: string; label: string; disabled?: boolean }[] = []
  const walk = (n: ReactNode): void => { Children.forEach(n, (c) => { if (isValidElement(c)) { const p = c.props as { value?: string | number; children?: ReactNode; disabled?: boolean }; if (c.type === 'option') opts.push({ value: String(p.value ?? (typeof p.children === 'string' ? p.children : '')), label: Array.isArray(p.children) ? p.children.join('') : String(p.children ?? ''), disabled: p.disabled }); else walk(p.children) } }) }
  walk(children)
  const native = (window as any).izlix?.nativeMenus === true
  if (!native) return <select value={String(value)} onChange={(e) => onChange({ target: { value: e.target.value } })} className={className} style={style} disabled={disabled} title={title} aria-label={ariaLabel}>{children}</select>
  const cur = opts.find((o) => o.value === String(value))
  return (
    <button type="button" className={`popup ${className ?? ''}`} style={style} disabled={disabled} title={title} aria-label={ariaLabel} aria-haspopup="menu"
      onClick={(e) => {
        const r = (e.currentTarget as HTMLElement).getBoundingClientRect()
        void (window as any).izlix.popupMenu(opts.map((o) => ({ label: o.label, checked: o.value === String(value), enabled: !o.disabled })), r.left, r.bottom + 2).then((i: number | null) => { if (i != null && opts[i]) onChange({ target: { value: opts[i].value } }) })
      }}>
      <span className="popup-l">{cur?.label ?? ''}</span>
      <svg width="9" height="12" viewBox="0 0 9 12" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M2 4.5 4.5 2 7 4.5M2 7.5 4.5 10 7 7.5" /></svg>
    </button>
  )
}
