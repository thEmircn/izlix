/** Ambient mod: oynayan videonun kenar renkleriyle videonun CEVRESINDE yumusak, sonen bir isik halkasi (YouTube "ambient" benzeri).
 *  Sayfa dunyasinda calisir; videoya dokunmaz, acik renkli sayfalarda kapali kalir, kareler arasinda yumusak gecis yapar. */
export const AMBIENT_SCRIPT = `(() => {
  if (window.__dbAmbient) return
  const S = (window.__dbAmbient = { on: true })
  const W = 32, H = 18
  const src = document.createElement('canvas'); src.width = W; src.height = H
  const sctx = src.getContext('2d', { willReadFrequently: true })
  const comp = document.createElement('canvas'), cctx = comp.getContext('2d')
  let el = null, ectx = null, vid = null, last = 0, kx = 0, ky = 0, fresh = true
  const FADE = 'linear-gradient(to right,transparent,#000 38%,#000 62%,transparent),linear-gradient(to bottom,transparent,#000 38%,#000 62%,transparent)'
  const make = () => {
    el = document.createElement('canvas'); el.id = '__db-ambient'
    el.setAttribute('aria-hidden', 'true')
    el.style.cssText = 'position:fixed;pointer-events:none;z-index:2147483646;opacity:0;transition:opacity .9s ease;filter:blur(40px) saturate(1.5);mix-blend-mode:screen;'
      + '-webkit-mask-image:' + FADE + ';-webkit-mask-composite:source-in;mask-image:' + FADE + ';mask-composite:intersect;'
    document.documentElement.appendChild(el); ectx = el.getContext('2d')
  }
  // sayfa arka plani acik ise isik gorunmez/kirli olur: kapat
  const dark = () => {
    for (const n of [document.body, document.documentElement]) {
      if (!n) continue
      const m = /rgba?\\((\\d+),\\s*(\\d+),\\s*(\\d+)(?:,\\s*([\\d.]+))?/.exec(getComputedStyle(n).backgroundColor)
      if (m && (m[4] === undefined || parseFloat(m[4]) > 0.5)) return (0.2126 * m[1] + 0.7152 * m[2] + 0.0722 * m[3]) / 255 < 0.35
    }
    return false
  }
  const pick = () => {
    let best = null, area = 0
    for (const v of document.getElementsByTagName('video')) {
      if (v.paused || v.ended || v.readyState < 2 || !v.videoWidth || v.__dbTaint) continue
      const r = v.getBoundingClientRect(), a = r.width * r.height
      if (r.width >= 320 && a > area && r.bottom > 0 && r.top < innerHeight) { best = v; area = a }
    }
    return best
  }
  // kare: video -> 32x18; kenarlar dis halkaya cogaltilir (halka rengi videonun kenar renkleridir)
  const build = () => {
    const w = comp.width, h = comp.height
    cctx.imageSmoothingEnabled = true
    cctx.drawImage(src, 0, 0, W, 1, kx, 0, W, ky); cctx.drawImage(src, 0, H - 1, W, 1, kx, ky + H, W, ky)
    cctx.drawImage(src, 0, 0, 1, H, 0, ky, kx, H); cctx.drawImage(src, W - 1, 0, 1, H, kx + W, ky, kx, H)
    cctx.drawImage(src, 0, 0, 1, 1, 0, 0, kx, ky); cctx.drawImage(src, W - 1, 0, 1, 1, kx + W, 0, kx, ky)
    cctx.drawImage(src, 0, H - 1, 1, 1, 0, ky + H, kx, ky); cctx.drawImage(src, W - 1, H - 1, 1, 1, kx + W, ky + H, kx, ky)
    cctx.drawImage(src, 0, 0, W, H, kx, ky, W, H)
    void w; void h
  }
  const place = () => {
    const r = vid.getBoundingClientRect(), pad = Math.round(Math.max(70, Math.min(180, Math.min(r.width, r.height) * 0.26)))
    const w = r.width + pad * 2, h = r.height + pad * 2, o = 3000
    el.style.left = r.left - pad + 'px'; el.style.top = r.top - pad + 'px'; el.style.width = w + 'px'; el.style.height = h + 'px'
    el.style.clipPath = 'polygon(evenodd, -'+o+'px -'+o+'px, '+(w+o)+'px -'+o+'px, '+(w+o)+'px '+(h+o)+'px, -'+o+'px '+(h+o)+'px, -'+o+'px -'+o+'px, '+pad+'px '+pad+'px, '+(pad+r.width)+'px '+pad+'px, '+(pad+r.width)+'px '+(pad+r.height)+'px, '+pad+'px '+(pad+r.height)+'px, '+pad+'px '+pad+'px)'
    return pad
  }
  const frame = (t) => {
    requestAnimationFrame(frame)
    if (!S.on || document.hidden) { if (el) el.style.opacity = '0'; return }
    if (t - last < 100) { if (vid && el && el.style.opacity !== '0') place(); return }
    last = t
    vid = pick()
    if (!vid || document.fullscreenElement || !dark()) { if (el) el.style.opacity = '0'; fresh = true; return }
    if (!el) make()
    try { sctx.drawImage(vid, 0, 0, W, H); sctx.getImageData(0, 0, 1, 1) } catch (e) { vid.__dbTaint = true; el.style.opacity = '0'; return }
    const r = vid.getBoundingClientRect(), pad = place()
    const nkx = Math.max(2, Math.round(pad / (r.width / W))), nky = Math.max(2, Math.round(pad / (r.height / H)))
    if (nkx !== kx || nky !== ky || comp.width !== W + 2 * nkx) { kx = nkx; ky = nky; comp.width = W + 2 * kx; comp.height = H + 2 * ky; el.width = comp.width; el.height = comp.height; fresh = true }
    build()
    ectx.globalAlpha = fresh ? 1 : 0.28 // onceki kareyle harmanla: renk gecisleri yumusak
    ectx.drawImage(comp, 0, 0); fresh = false
    el.style.opacity = '0.72'
  }
  requestAnimationFrame(frame)
})()`
