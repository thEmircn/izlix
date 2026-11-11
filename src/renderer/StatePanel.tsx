import { useMemo, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { useStore, useT } from './store'
import { JsonTree } from './JsonTree'

/** Durum paneli: Redux / Redux Toolkit / Zustand (devtools) / Jotai / Valtio store'lari. Eylem gunlugu, secilen andaki durum ve degisen anahtarlar. */
export function StatePanel({ events }: { events: BusEvent[] }) {
  const t = useT()
  const tabId = useStore((s) => s.activeTabId)
  const list = useMemo(() => events.filter((e) => e.kind === 'state' && e.source === 'store:devtools' && e.tabId === tabId), [events, tabId])
  const stores = useMemo(() => [...new Set(list.map((e) => e.payload.store as string))], [list])
  const [store, setStore] = useState<string>('')
  const [sel, setSel] = useState<number | null>(null)
  const cur = stores.includes(store) ? store : stores[0] ?? ''
  const rows = list.filter((e) => e.payload.store === cur).slice().reverse()
  const picked = rows.find((e) => e.id === sel) ?? rows[0]
  const set = useStore((s) => s.set)
  if (!list.length) return <div className="state"><div className="empty-hint">{t('state.empty')}</div></div>
  return (
    <div className="state">
      <div className="net-bar">
        {stores.length > 1 ? <div className="chips">{stores.map((s) => <button key={s} className={`fchip ${s === cur ? 'on' : ''}`} onClick={() => { setStore(s); setSel(null) }}>{s}</button>)}</div> : <b style={{ fontSize: 12 }}>{cur}</b>}
        <span style={{ flex: 1 }} /><span style={{ color: 'var(--dim)', fontSize: 12 }}>{t('state.count', { n: rows.length })}</span>
        {picked && <button className="btn" onClick={() => void navigator.clipboard.writeText(JSON.stringify(picked.payload.state, null, 2))}>{t('state.copy')}</button>}
      </div>
      <div className="state-main">
        <div className="state-log">
          {rows.map((e) => (
            <div key={e.id} className={`state-row ${picked?.id === e.id ? 'on' : ''}`} onClick={() => { setSel(e.id); set({ selectedEventId: e.id }) }}>
              <code>{new Date(e.ts).toLocaleTimeString(undefined, { hour12: false })}</code><b>{e.payload.action}</b>
              {e.payload.changed?.length > 0 && <small>{(e.payload.changed as string[]).slice(0, 4).join(', ')}{e.payload.changed.length > 4 ? '…' : ''}</small>}
            </div>
          ))}
        </div>
        <div className="state-tree">{picked && <><div className="shint" style={{ marginBottom: 6 }}>{t('state.after', { a: picked.payload.action })}{picked.payload.changed?.length ? ` · ${t('state.changed')}: ${(picked.payload.changed as string[]).join(', ')}` : ''}</div><JsonTree value={picked.payload.state} /></>}</div>
      </div>
    </div>
  )
}
