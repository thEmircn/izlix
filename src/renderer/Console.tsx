import { Segmented } from '../../packages/ui/src'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { BusEvent } from '../shared/events'
import { LEVEL_ORDER, buildConsoleRows, type ConsoleRow, type Level } from '../shared/console'
import { useStore, useT, writePref } from './store'

const time = (ts: number): string => { const d = new Date(ts); return d.toTimeString().slice(0, 8) + '.' + String(d.getMilliseconds()).padStart(3, '0') }

/** Console paneli: seviye suzgeci, tekrar sayaci, acilir stack ve kaynaga gitme. */
export function Console({ events }: { events: BusEvent[] }) {
  const t = useT()
  const editor = useStore((s) => s.editor)
  const preserve = useStore((s) => s.preserveLog)
  const [levels, setLevels] = useState<Set<Level>>(new Set(LEVEL_ORDER))
  const [q, setQ] = useState('')
  const [open, setOpen] = useState<number | null>(null)
  const [clearedAt, setClearedAt] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)
  const tabId = useStore((s) => s.activeTabId)
  const [repl, setRepl] = useState<{ id: number; expr: string; ok: boolean; text: string }[]>([])
  const [input, setInput] = useState('')
  const history = useRef<string[]>([]); const hIdx = useRef(-1)
  const run = async (): Promise<void> => {
    const expr = input.trim(); if (!expr || !tabId) return
    history.current.unshift(expr); hIdx.current = -1; setInput('')
    const id = Date.now()
    const r = await window.izlix.evalInPage(tabId, expr)
    setRepl((x) => [...x.slice(-100), { id, expr, ok: !!r?.ok, text: String(r?.text ?? '') }])
    stick.current = true
  }
  const stick = useRef(true)

  const all = useMemo(() => buildConsoleRows(events.filter((e) => e.ts >= clearedAt)), [events, clearedAt])
  const counts = useMemo(() => { const c: Record<string, number> = {}; for (const r of all) c[r.level] = (c[r.level] ?? 0) + r.count; return c }, [all])
  const rows = useMemo(() => { const n = q.trim().toLowerCase(); return all.filter((r) => levels.has(r.level) && (!n || r.text.toLowerCase().includes(n))) }, [all, levels, q])
  useEffect(() => { const el = listRef.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [rows.length, repl.length])
  const toggle = (l: Level): void => setLevels((s) => { const n = new Set(s); n.has(l) ? n.delete(l) : n.add(l); return n })

  return (
    <div className="con">
      <div className="net-bar">
        {(() => {
          const sel = levels.size === LEVEL_ORDER.length ? 'all' : ([...levels][0] as string)
          const n = (l: Level): string => (counts[l] ? ` ${counts[l]}` : '')
          return (
            <Segmented small label="Level" value={sel} onChange={(k) => setLevels(new Set(k === 'all' ? LEVEL_ORDER : [k as Level]))}
              items={[{ key: 'all', label: t('con.all' as any) }, ...LEVEL_ORDER.map((l) => ({ key: l as string, label: t(`lv.${l}` as any) + n(l) }))]} />
          )
        })()}
        <label className="tgl"><input type="checkbox" checked={preserve} onChange={(e) => { writePref('preserveLog', e.target.checked ? '1' : '0'); useStore.getState().set({ preserveLog: e.target.checked }) }} />{t('net.preserve')}</label>
        <input className="search" placeholder={t('con.search')} value={q} onChange={(e) => setQ(e.target.value)} />
        <button className="btn iconbtn" aria-label={t('net.clear')} title={t('net.clear')} onClick={() => { setClearedAt(Date.now()); setOpen(null) }}><svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"><circle cx="7" cy="7" r="5.5" /><path d="m4.5 9.5 5-5" /></svg></button>
      </div>
      <div className="con-list" ref={listRef} onScroll={(e) => { const el = e.currentTarget; stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 40 }}>
        {rows.map((r) => <Line key={r.id} r={r} open={open === r.id} onToggle={() => setOpen(open === r.id ? null : r.id)} editor={editor} />)}
        {repl.map((r) => (
          <div key={r.id} className="repl-pair">
            <div className="repl-in"><b>›</b> {r.expr}</div>
            <div className={`repl-out ${r.ok ? '' : 'err'}`}>{r.text}</div>
          </div>
        ))}
        {!rows.length && !repl.length && <div className="empty-hint">{t('con.empty')}</div>}
      </div>
      <div className="repl-bar">
        <b>›</b>
        <input value={input} spellCheck={false} placeholder={t('con.repl')} onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') void run()
            else if (e.key === 'ArrowUp') { e.preventDefault(); hIdx.current = Math.min(hIdx.current + 1, history.current.length - 1); setInput(history.current[hIdx.current] ?? '') }
            else if (e.key === 'ArrowDown') { e.preventDefault(); hIdx.current = Math.max(hIdx.current - 1, -1); setInput(history.current[hIdx.current] ?? '') }
          }} />
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
      {open && r.stack && <div className="stack-trace">{r.stack.map((f, i) => <div key={i}><span>{f.fn}</span>{/^https?:/.test(f.url) ? <a href="#" className="stlink" onClick={(e) => { e.preventDefault(); useStore.getState().set({ panelTab: 'sources', sourceTarget: { url: f.url, line: f.line, col: f.col } }) }}>{f.url.split('/').slice(-2).join('/')}:{f.line}:{f.col}</a> : <code>{f.url.split('/').slice(-2).join('/')}:{f.line}:{f.col}</code>}</div>)}</div>}
    </div>
  )
}
