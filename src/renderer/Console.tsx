import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { LEVEL_ORDER, buildConsoleRows, type ConsoleRow, type Level } from '../shared/console'
import { useStore, useT } from './store'

const time = (ts: number): string => { const d = new Date(ts); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0') }

/** Console paneli: seviye suzgeci, tekrar sayaci, acilir stack ve kaynaga gitme. */
export function Console({ events }: { events: BusEvent[] }) {
  const t = useT()
  const editor = useStore((s) => s.editor)
  const [levels, setLevels] = useState<Set<Level>>(new Set(LEVEL_ORDER))
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [clearedAt, setClearedAt] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const stick = useRef(true)

  const all = useMemo(() => buildConsoleRows(events.filter((e) => e.ts >= clearedAt)), [events, clearedAt])
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const r of all) c[r.level] = (c[r.level] ?? 0) + r.count; return c }, [all])
  const rows = useMemo(() => { const n = q.trim().toLowerCase(); return all.filter((r) => levels.has(r.level) && (!n || r.text.toLowerCase().includes(n))) }, [all, levels, q])
  useEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [rows.length])
  const toggle = (l: Level): void => setLevels((s) => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n })

  return (
    <div className="con">
      <div className="net-bar">
        <div className="chips">
          {LEVEL_ORDER.map((l) => (
            <button key={l} className={`fchip lv-${l} ${levels.has(l) ? 'on' : ''}`} onClick={() => toggle(l)}>{l}<em>{counts[l] ?? 0}</em></button>
          ))}
        </div>
        <input className="search" placeholder={t('con.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn" onClick={() => { setClearedAt(Date.now()); setOpen(null) }}>{t('net.clear')}</button>
      </div>
      <div className="con-list" ref={listRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
        {rows.map((r) => <Line key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} editor={editor} />)}
        {!rows.length && <div className="empty-hint">{t('con.empty')}</div>}
      </div>
    </div>
  )
}

function Line({ r, open, onToggle, editor }: { r: ConsoleRow; open: boolean; onToggle(): void; editor: string }) {
  const expandable = !!(r.stack || r.origin)
  return (
    <div className={`con-row lv-${r.level} ${open ? 'open' : ''}`}>
      <div className="con-main" onClick={expandable ? onToggle : undefined} style={{ cursor: expandable ? 'pointer' : 'default' }}>
        <i className="lvdot" />
        <span className="ts">{time(r.ts)}</span>
        <span className="msg">{r.text}</span>
        {r.count > 1 && <b key={r.count} className="count">{r.count}</b>}
        {r.origin && <a className="src" href="#" onClick={(e) => { e.preventDefault(); e.stopPropagation(); void window.izlix.openSource({ file: r.origin!.file, line: r.origin!.line, column: r.origin!.column, editor }) }}>{r.origin.file.split('/').slice(-2).join('/')}:{r.origin.line}</a>}
      </div>
      {open && r.stack && <div className="stack-trace">{r.stack.map((f, i) => <div key={i}><span>{f.fn}</span><code>{f.url.split('/').slice(-2).join('/')}:{f.line}:{f.col}</code></div>)}</div>}
    </div>
  )
}
