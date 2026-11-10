import { useT } from './store'
import { Kbd } from './ui'

const GROUPS: { title: string; items: [string, string][] }[] = [
  { title: 'sc.g.general', items: [['⌘K', 'sc.palette'], ['⌘,', 'sc.settings'], ['⇧⌘R', 'sc.rules'], ['⌘/', 'sc.shortcuts'], ['⌘F', 'sc.find']] },
  { title: 'sc.g.tabs', items: [['⌘T', 'sc.newTab'], ['⌘W', 'sc.closeTab'], ['⇧⌘T', 'sc.reopen'], ['⌘1–9', 'sc.goTab'], ['⌃Tab', 'sc.nextTab'], ['⌘L', 'sc.address'], ['⌘R', 'sc.reload'], ['⌘D', 'sc.bookmark']] },
  { title: 'sc.g.panels', items: [['⌥⌘1', 'sc.timeline'], ['⌥⌘2', 'sc.network'], ['⌥⌘3', 'sc.console'], ['⌥⌘4', 'sc.elements'], ['⌥⌘5', 'sc.sources'], ['⌥⌘6', 'sc.storage'], ['⌥⌘7', 'sc.perf'], ['⌥⌘8', 'sc.coverage'], ['⌥⌘9', 'sc.a11y'], ['⌥⌘I', 'sc.devtools']] }
]

export function Shortcuts({ onClose }: { onClose(): void }) {
  const t = useT()
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('sc.title')} style={{ width: 'min(640px, 94vw)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }} tabIndex={-1} ref={(el) => el?.focus()}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)' }}><b style={{ fontSize: 14 }}>{t('sc.title')}</b></div>
        <div className="scgrid">
          {GROUPS.map((g) => (
            <div key={g.title}><h4 className="sec" style={{ margin: '0 0 6px' }}>{t(g.title as any)}</h4>
              {g.items.map(([k, d]) => <div key={k} className="scrow"><span>{t(d as any)}</span><Kbd>{k}</Kbd></div>)}</div>
          ))}
        </div>
      </div>
    </div>
  )
}
