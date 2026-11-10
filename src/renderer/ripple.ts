// Su dalgasi: tiklanan oge uzerinde tiklama noktasindan yayilan yumusak halka. Olay delegasyonu: tek dinleyici, bilesenlere dokunmaz.
const SEL = '.btn, .tb-btn, .tab, .newtab, .rail button, .chip, .fchip, .act, .seg2 button, .lab-pill button, .tile.hero, .pal-item, .icon-btn'

export function installRipple(): void {
  if (typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches) return
  document.addEventListener('pointerdown', (e) => {
    const el = (e.target as Element | null)?.closest?.(SEL) as HTMLElement | null
    if (!el || (el as HTMLButtonElement).disabled || el.closest('.rail')) return
    const r = el.getBoundingClientRect()
    const size = Math.max(r.width, r.height) * 2.2
    const dot = document.createElement('span')
    dot.className = 'ripple'
    dot.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - r.left - size / 2}px;top:${e.clientY - r.top - size / 2}px`
    if (getComputedStyle(el).position === 'static') el.style.position = 'relative'
    el.classList.add('has-ripple'); el.appendChild(dot)
    dot.addEventListener('animationend', () => dot.remove(), { once: true })
    setTimeout(() => dot.remove(), 900)
  }, true)
}
