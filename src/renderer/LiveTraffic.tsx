import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { buildNetworkRows, formatBytes } from '../shared/network'
import { binEvents, binTraffic, rate, smooth } from '../shared/traffic'
import { useT } from './store'

const MAX_WIN = 60_000, MIN_WIN = 10_000
const ORANGE = [255, 106, 43], RED = [255, 92, 92], WHITE = [235, 235, 238]
const rgba = (c: number[], a: number): string => `rgba(${c[0]},${c[1]},${c[2]},${a})`

/** Canli ag trafigi: 60 sn'lik pencere surekli kayar; istek/sn (turuncu alan), bayt/sn (beyaz cizgi), hatalar (kirmizi), uc nokta nabiz atar. */
export function LiveTraffic({ events, height = 150, compact = false, mode = 'net' }: { events: BusEvent[]; height?: number; compact?: boolean; mode?: 'net' | 'activity' }) {
  const t = useT()
  const tRef = useRef(t); tRef.current = t
  const rows = useMemo(() => (mode === 'net' ? buildNetworkRows(events) : []), [events, mode])
  const rowsRef = useRef(rows); rowsRef.current = rows
  const evRef = useRef(events); evRef.current = events
  const firstRef = useRef<number | null>(null)
  firstRef.current = mode === 'net' ? rows.reduce<number | null>((m, r) => (r.type === 'ws' ? m : m == null || r.start < m ? r.start : m), null) : (events.length ? events[0].ts : null)
  const cv = useRef<HTMLCanvasElement>(null)
  const wrap = useRef<HTMLDivElement>(null)
  const tip = useRef<HTMLDivElement>(null)
  const hover = useRef<number | null>(null)
  const [hud, setHud] = useState({ rps: 0, bps: 0, pending: 0, total: 0, fails: 0 })
  const ymax = useRef(3), bmax = useRef(1024)

  useEffect(() => {
    const canvas = cv.current, box = wrap.current
    if (!canvas || !box) return
    const ctx = canvas.getContext('2d'); if (!ctx) return
    const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    let W = 0, H = height, dpr = 1, raf = 0, stopped = false, lastHud = 0
    const resize = (): void => { dpr = window.devicePixelRatio || 1; W = box.clientWidth; canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); canvas.style.width = W + 'px'; canvas.style.height = H + 'px' }
    resize(); const ro = new ResizeObserver(resize); ro.observe(box)

    const draw = (ts: number): void => {
      if (stopped) return
      const now = Date.now()
      // pencere veri suresine uyar: grafik ilk istekten (0 sn) baslar ve tum genisligi doldurur; 60 sn'yi asinca kayar
      const first = firstRef.current
      const win = Math.min(MAX_WIN, Math.max(MIN_WIN, first == null ? MIN_WIN : now - first + 1000))
      const b = mode === 'net' ? binTraffic(rowsRef.current, now, win, win <= 20_000 ? 250 : 500) : binEvents(evRef.current, now, win, win <= 20_000 ? 250 : 500)
      const sr = smooth(b.reqs), sb = smooth(b.bytes)
      const padT = compact ? 6 : 10, padB = compact ? 16 : 20, padL = 0, ph = H - padT - padB
      const x = (tm: number): number => padL + ((tm - (now - win)) / win) * (W - padL)
      const yR = (v: number): number => padT + ph - (v / ymax.current) * ph
      const yB = (v: number): number => padT + ph - (v / bmax.current) * ph
      // olcek hedefleri (yumusak gecis)
      const tr = Math.max(3, ...sr) * 1.3, tb = Math.max(1024, ...sb) * 1.3
      ymax.current += (tr - ymax.current) * 0.08; bmax.current += (tb - bmax.current) * 0.08

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, W, H)
      // yatay izgara + etiketler
      ctx.font = '10px ui-monospace, Menlo, monospace'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left'
      for (let g = 0; g <= 3; g++) {
        const yy = padT + (ph * g) / 3
        ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.setLineDash([2, 5]); ctx.beginPath(); ctx.moveTo(0, yy); ctx.lineTo(W, yy); ctx.stroke(); ctx.setLineDash([])
        if (!compact && g === 3) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillText('0', 4, yy - 7) }
        if (!compact && g < 3) { ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillText(((ymax.current * (3 - g)) / 3).toFixed(ymax.current < 6 ? 1 : 0), 4, g === 0 ? yy + 8 : yy - 7) }
      }
      // dikey zaman izgarasi: 5 sn'de bir, kayar
      const step = win <= 20_000 ? 2000 : 5000, gFirst = Math.ceil((now - win) / step) * step
      ctx.strokeStyle = 'rgba(255,255,255,.04)'
      for (let tm = gFirst; tm <= now; tm += step) { const xx = x(tm); ctx.beginPath(); ctx.moveTo(xx, padT); ctx.lineTo(xx, padT + ph); ctx.stroke() }
      // x ekseni etiketleri
      ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.textBaseline = 'alphabetic'
      ctx.textAlign = 'left'; ctx.fillText(`-${Math.round(win / 1000)}s`, 4, H - 4); ctx.textAlign = 'center'; ctx.fillText(`-${Math.round(win / 2000)}s`, W / 2, H - 4); ctx.textAlign = 'right'; ctx.fillText(tRef.current('ov.now'), W - 4, H - 4)

      const pts = (arr: number[], y: (v: number) => number): [number, number][] => arr.map((v, i) => [x(b.startT + i * b.binMs + b.binMs / 2), y(v)])
      const trace = (p: [number, number][]): void => {
        ctx.moveTo(p[0][0], p[0][1])
        for (let i = 0; i < p.length - 1; i++) { const cx = (p[i][0] + p[i + 1][0]) / 2; ctx.bezierCurveTo(cx, p[i][1], cx, p[i + 1][1], p[i + 1][0], p[i + 1][1]) }
      }
      // bayt cizgisi (beyaz, ince)
      const pB = pts(sb, yB)
      ctx.beginPath(); trace(pB); ctx.strokeStyle = rgba(WHITE, 0.45); ctx.lineWidth = 1.2; ctx.setLineDash([1, 0]); ctx.stroke()
      // istek alani + parlak cizgi
      const pR = pts(sr, yR)
      const grad = ctx.createLinearGradient(0, padT, 0, padT + ph); grad.addColorStop(0, rgba(ORANGE, 0.42)); grad.addColorStop(1, rgba(ORANGE, 0))
      ctx.beginPath(); trace(pR); ctx.lineTo(pR[pR.length - 1][0], padT + ph); ctx.lineTo(pR[0][0], padT + ph); ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
      ctx.save(); ctx.shadowColor = rgba(ORANGE, 0.9); ctx.shadowBlur = 12; ctx.beginPath(); trace(pR); ctx.strokeStyle = rgba(ORANGE, 1); ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore()
      // hatalar: tabanda kirmizi nokta + kisa isaret cubugu
      for (let i = 0; i < b.fails.length; i++) if (b.fails[i] > 0) {
        const px = x(b.startT + i * b.binMs + b.binMs / 2), base = padT + ph
        ctx.strokeStyle = rgba(RED, 0.6); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(px, base - 4); ctx.lineTo(px, base - 16); ctx.stroke()
        ctx.fillStyle = rgba(RED, 1); ctx.beginPath(); ctx.arc(px, base - 2, 3, 0, 7); ctx.fill()
      }
      // uc nokta: nabiz
      const tail = pR[pR.length - 2] ?? pR[pR.length - 1]
      const ph2 = (ts % 1600) / 1600
      ctx.fillStyle = rgba(ORANGE, 0.35 * (1 - ph2)); ctx.beginPath(); ctx.arc(W - 3, tail[1], 4 + ph2 * 10, 0, 7); ctx.fill()
      ctx.fillStyle = rgba(ORANGE, 1); ctx.beginPath(); ctx.arc(W - 3, tail[1], 3, 0, 7); ctx.fill()
      // imlec
      const hx = hover.current
      if (hx != null && tip.current) {
        const tm = now - win + (hx / W) * win, i = Math.max(0, Math.min(b.reqs.length - 1, Math.floor((tm - b.startT) / b.binMs)))
        ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(hx, padT); ctx.lineTo(hx, padT + ph); ctx.stroke(); ctx.setLineDash([])
        ctx.fillStyle = '#0a0a0b'; ctx.strokeStyle = rgba(ORANGE, 1); ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(hx, yR(sr[i]), 4, 0, 7); ctx.fill(); ctx.stroke()
        const ago = Math.max(0, Math.round((now - tm) / 1000))
        tip.current.style.opacity = '1'; tip.current.style.transform = `translateX(${Math.min(W - 130, Math.max(0, hx - 60))}px)`
        tip.current.textContent = mode === 'net' ? `-${ago}s · ${b.reqs[i]} ${tRef.current('ov.requests').toLowerCase()} · ${formatBytes(Math.round(b.bytes[i])) || '0 B'}${b.fails[i] ? ` · ${b.fails[i]} !` : ''}` : `-${ago}s · ${b.reqs[i]} ${tRef.current('live.events')} · ${b.bytes[i]} render${b.fails[i] ? ` · ${b.fails[i]} !` : ''}`
      } else if (tip.current) tip.current.style.opacity = '0'

      if (ts - lastHud > 250) {
        lastHud = ts
        const rs = rowsRef.current
        setHud({ rps: rate(b, b.reqs, 3), bps: rate(b, b.bytes, 3), pending: mode === 'net' ? rs.filter((r) => r.end == null && !r.failed && r.type !== 'ws' && now - r.start < 30_000).length : 0, total: mode === 'net' ? rs.filter((r) => r.type !== 'ws').length : evRef.current.length, fails: b.fails.reduce((a, c) => a + c, 0) })
      }
      raf = reduce ? window.setTimeout(() => draw(performance.now()), 500) as unknown as number : requestAnimationFrame(draw)
    }
    raf = requestAnimationFrame(draw)
    return () => { stopped = true; cancelAnimationFrame(raf); clearTimeout(raf); ro.disconnect() }
  }, [height, compact, mode])

  return (
    <div className={`live ${compact ? 'compact' : ''}`}>
      <div className="live-hud">
        <span className="pill ok live-pill"><i />{t('live.title')}</span>
        <div className="hud"><b>{hud.rps.toFixed(hud.rps < 10 ? 1 : 0)}</b><small>{t(mode === 'net' ? 'live.rps' : 'live.eps')}</small></div>
        {mode === 'net' ? <div className="hud"><b>{formatBytes(Math.round(hud.bps)) || '0 B'}</b><small>{t('live.bps')}</small></div> : <div className="hud"><b>{hud.bps.toFixed(hud.bps < 10 ? 1 : 0)}</b><small>{t('live.rendersps')}</small></div>}
        {mode === 'net' && <div className="hud"><b>{hud.pending}</b><small>{t('live.pending')}</small></div>}
        {hud.fails > 0 && <div className="hud bad"><b>{hud.fails}</b><small>{t('live.fails')}</small></div>}
        <span className="live-legend"><i style={{ background: 'rgb(255,106,43)' }} />{t(mode === 'net' ? 'live.reqs' : 'live.events')}<i style={{ background: 'rgba(235,235,238,.6)' }} />{t(mode === 'net' ? 'live.bytes' : 'live.renders')}</span>
      </div>
      <div className="live-canvas" ref={wrap} style={{ height }}
        onMouseMove={(e) => { const r = e.currentTarget.getBoundingClientRect(); hover.current = e.clientX - r.left }}
        onMouseLeave={() => { hover.current = null }}>
        <canvas ref={cv} />
        <div ref={tip} className="live-tip" />
      </div>
    </div>
  )
}
