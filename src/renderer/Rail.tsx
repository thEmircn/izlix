import { tNow } from './store'
import { useLayoutEffect, useRef, useState, type ComponentType, type SVGProps } from 'react'
import type { PanelTab } from './store'
import { Forward, IcA11y, IcComponents, IcConsole, IcCoverage, IcElements, IcNetwork, IcOverview, IcPerf, IcProfiler, IcRaw, IcRenders, IcSeo, IcServer, IcSources, IcStorage, IcTimeline } from './icons'

export const RAIL_ICONS: Record<PanelTab, ComponentType<SVGProps<SVGSVGElement>>> = {
  overview: IcOverview, timeline: IcTimeline, network: IcNetwork, console: IcConsole, elements: IcElements, sources: IcSources, storage: IcStorage, perf: IcPerf,
  coverage: IcCoverage, a11y: IcA11y, profiler: IcProfiler, seo: IcSeo, server: IcServer, components: IcComponents, renders: IcRenders, raw: IcRaw
}

/** Gorunum sirasi ve gruplari (PANEL_TABS dizisinden bagimsiz: kisayol numaralari degismez). */
export const RAIL_GROUPS: PanelTab[][] = [
  ['overview', 'timeline', 'network', 'console'],
  ['elements', 'sources', 'storage'],
  ['perf', 'coverage', 'profiler', 'a11y', 'seo'],
  ['components', 'renders', 'server', 'raw']
]

/** Sol ikon rayi: her panel bir ikon; secili olan vurgulu hap, uzerine gelince etiket. */
export function Rail({ value, onChange, labels }: { value: PanelTab; onChange(k: PanelTab): void; labels: Record<PanelTab, string> }) {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('railOpen') === '1' } catch { return false } })
  const toggle = (): void => { setOpen(!open); try { localStorage.setItem('railOpen', open ? '0' : '1') } catch { /* yok say */ } }
  const ref = useRef<HTMLElement>(null)
  const [y, setY] = useState<number | null>(null)
  useLayoutEffect(() => { const b = ref.current?.querySelector<HTMLElement>('button.on'); setY(b ? b.offsetTop : null) }, [value, open])
  return (
    <nav ref={ref} className={`rail seg2 ${open ? 'open' : ''}`} role="tablist" aria-orientation="vertical">
      {y != null && <div className="rail-ind" style={{ transform: `translateY(${y}px)` }} />}
      <button className="rail-toggle" aria-label={tNow('rail.toggle')} onClick={toggle}><Forward /></button>
      {RAIL_GROUPS.map((g, gi) => [
        <i key={`s${gi}`} className="rail-sep" />,
        ...g.map((k) => {
          const I = RAIL_ICONS[k]
          return (
            <button key={k} role="tab" aria-selected={k === value} className={k === value ? 'on' : ''} onClick={() => onChange(k)} title={labels[k]}>
              <I /><span className="rl">{labels[k]}</span>
            </button>
          )
        })
      ])}
    </nav>
  )
}
