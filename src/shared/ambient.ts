/** Ambient mod: oynayan videonun renkleriyle sayfada videonun cevresine yumusak isik (YouTube "ambient" benzeri). Sayfa dunyasinda calisir; videonun kendisine dokunmaz. */
export const AMBIENT_SCRIPT = `(() => {
  if (window.__dbAmbient) return
  const S = (window.__dbAmbient = { on: true })
  const W = 32, H = 18
  const src = document.createElement('canvas'); src.width = W; src.height = H
  const sctx = src.getContext('2d', { willReadFrequently: true })
  let el = null, vid = null, last = 0, raf = 0
  const make = () => {
    el = document.createElement('canvas'); el.id = '__db-ambient'; el.width = W; el.height = H
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;opacity:0;transition:opacity .7s ease;filter:blur(44px) saturate(1.9) brightness(1.15);mix-blend-mode:screen;'
    ;(document.documentElement).appendChild(el)
  }
  const pick = () => {
    let best = null, area = 0
    for (const v of document.getElementsByTagName('video')) {
      if (v.paused || v.ended || v.readyState < 2 || !v.videoWidth || v.__dbTaint) continue
      const r = v.getBoundingClientRect(); const a = r.width * r.height
      if (r.width >= 320 && a > area && r.bottom > 0 && r.top < innerHeight) { best = v; area = a }
    }
    return best
  }
  const frame = (t) => {
    raf = requestAnimationFrame(frame)
    if (!S.on) { if (el) el.style.opacity = '0'; return }
    if (t - last < 90) { if (vid && el) place(); return }
    last = t
    vid = pick()
    if (!vid || document.fullscreenElement) { if (el) el.style.opacity = '0'; return }
    if (!el) make()
    try { sctx.drawImage(vid, 0, 0, W, H); const d = sctx.getImageData(0, 0, 1, 1); void d } catch (e) { vid.__dbTaint = true; el.style.opacity = '0'; return }
    el.getContext('2d').drawImage(src, 0, 0)
    place(); el.style.opacity = '0.62'
  }
  const place = () => {
    const r = vid.getBoundingClientRect(), pad = Math.round(Math.min(170, Math.max(r.width, r.height) * 0.2))
    const w = r.width + pad * 2, h = r.height + pad * 2, o = 3000
    el.style.left = r.left - pad + 'px'; el.style.top = r.top - pad + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'
    el.style.clipPath = 'polygon(evenodd, -'+o+'px -'+o+'px, '+(w+o)+'px -'+o+'px, '+(w+o)+'px '+(h+o)+'px, -'+o+'px '+(h+o)+'px, -'+o+'px -'+o+'px, '+pad+'px '+pad+'px, '+(pad+r.width)+'px '+pad+'px, '+(pad+r.width)+'px '+(pad+r.height)+'px, '+pad+'px '+(pad+r.height)+'px, '+pad+'px '+pad+'px)'
  }
  raf = requestAnimationFrame(frame)
})()`
