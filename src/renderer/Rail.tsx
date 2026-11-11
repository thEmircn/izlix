import { useRef, type ComponentType, type SVGProps } from 'react'
import type { PanelTab } from './store'
import { IcA11y, IcComponents, IcConsole, IcCoverage, IcElements, IcNetwork, IcOverview, IcPerf, IcProfiler, IcRaw, IcRenders, IcSeo, IcServer, IcSources, IcStorage, IcStyle, IcTimeline } from './icons'
import { Seg } from './ui'

type Ic = ComponentType<SVGProps<SVGSVGElement>>
export const RAIL_ICONS: Record<PanelTab, Ic> = {
  overview: IcOverview, stylelab: IcStyle, timeline: IcTimeline, network: IcNetwork, console: IcConsole, elements: IcElements, sources: IcSources, storage: IcStorage, perf: IcPerf,
  coverage: IcCoverage, a11y: IcA11y, profiler: IcProfiler, seo: IcSeo, server: IcServer, components: IcComponents, renders: IcRenders, raw: IcRaw
}

/** Ray ogeleri: birden cok sekmesi olan gruplar panel basliginda alt sekmelerle acilir (16 ikon yerine 10 oge). */
export interface RailGroup { tabs: PanelTab[]; icon: Ic; label: 'timeline' | 'network' | 'console' | 'elements' | 'sources' | 'storage' | 'perf' | 'quality' | 'react' | 'server' }
export const RAIL_SETS: RailGroup[][] = [
  [{ tabs: ['timeline', 'raw'], icon: IcTimeline, label: 'timeline' }, { tabs: ['network'], icon: IcNetwork, label: 'network' }, { tabs: ['console'], icon: IcConsole, label: 'console' }],
  [{ tabs: ['elements', 'stylelab'], icon: IcElements, label: 'elements' }, { tabs: ['sources'], icon: IcSources, label: 'sources' }, { tabs: ['storage'], icon: IcStorage, label: 'storage' }],
  [{ tabs: ['perf', 'coverage', 'profiler'], icon: IcPerf, label: 'perf' }, { tabs: ['a11y', 'seo'], icon: IcA11y, label: 'quality' }],
  [{ tabs: ['components', 'renders'], icon: IcComponents, label: 'react' }, { tabs: ['server'], icon: IcServer, label: 'server' }]
]
export const RAIL_GROUPS: RailGroup[] = RAIL_SETS.flat()
export const groupOf = (tab: PanelTab): RailGroup | undefined => RAIL_GROUPS.find((g) => g.tabs.includes(tab))

/** Alt dock: panelin altinda yuzen cam hap; ikonlar, secili olan etiketiyle acilir. */
export function Rail({ value, onChange, labels, groupLabels, badges = {} }: { value: PanelTab; onChange(k: PanelTab): void; labels: Record<PanelTab, string>; groupLabels: Record<RailGroup['label'], string>; badges?: Partial<Record<RailGroup['label'], number>> }) {
  const mem = useRef<Record<string, PanelTab>>({}) // grup basina son kullanilan sekme
  mem.current[groupOf(value)?.label ?? ''] = value
  return (
    <nav className="rail seg2 dock" role="tablist" aria-orientation="horizontal" data-labels={labels.timeline}>
      {RAIL_SETS.map((set, si) => [
        si > 0 ? <i key={`s${si}`} className="rail-sep" /> : null,
        ...set.map((g) => {
          const I = g.icon, on = g.tabs.includes(value), name = groupLabels[g.label]
          return (
            <button key={g.label} role="tab" aria-selected={on} className={on ? 'on' : ''} data-badge={badges[g.label] ? (badges[g.label]! > 99 ? '99+' : String(badges[g.label])) : undefined} onClick={() => onChange(mem.current[g.label] && g.tabs.includes(mem.current[g.label]) ? mem.current[g.label] : g.tabs[0])} title={name}>
              <I /><span className="rl">{name}</span>
            </button>
          )
        })
      ])}
    </nav>
  )
}

/** Panel basliginda grubun alt sekmeleri. Test/erisilebilirlik icin diger gruplarin alt sekmeleri DOM'da gizli tutulur. */
export function SubNav({ value, onChange, labels }: { value: PanelTab; onChange(k: PanelTab): void; labels: Record<PanelTab, string> }) {
  const mk = (g: RailGroup) => <Seg<PanelTab> small value={g.tabs.includes(value) ? value : g.tabs[0]} onChange={onChange} items={g.tabs.map((k) => ({ key: k, label: labels[k] }))} />
  const cur = groupOf(value)
  return (
    <>
      {cur && cur.tabs.length > 1 ? mk(cur) : null}
      <div hidden>{RAIL_GROUPS.filter((g) => g !== cur && g.tabs.length > 1).map((g) => <span key={g.label}>{mk(g)}</span>)}</div>
    </>
  )
}
