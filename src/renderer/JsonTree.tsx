import { useState } from 'react'
import { jsonPath } from '../shared/netlab'
import { toast, tNow } from './store'

const isObj = (v: unknown): v is Record<string, unknown> | unknown[] => v !== null && typeof v === 'object'

function Node({ k, v, path, depth, q }: { k: string | number | null; v: unknown; path: string; depth: number; q: string }) {
  const [open, setOpen] = useState(depth < 2)
  const copy = (e: React.MouseEvent): void => { e.stopPropagation(); void navigator.clipboard?.writeText(path); toast(tNow('toast.copied')) }
  const label = k == null ? null : <span className="jk" onClick={copy} title={path}>{typeof k === 'number' ? k : JSON.stringify(k)}</span>
  if (!isObj(v)) {
    const cls = v === null ? 'jn' : typeof v === 'string' ? 'js' : typeof v === 'number' ? 'jnum' : 'jb'
    const s = typeof v === 'string' ? JSON.stringify(v) : String(v)
    return <div className="jrow" style={{ paddingLeft: depth * 14 }}>{label}{label && <i>:</i>}<span className={`jv ${cls} ${q && s.toLowerCase().includes(q) ? 'hit' : ''}`}>{s.length > 300 ? s.slice(0, 300) + '…' : s}</span></div>
  }
  const arr = Array.isArray(v), entries = arr ? (v as unknown[]).map((x, i) => [i, x] as [number, unknown]) : Object.entries(v as object)
  return (
    <div>
      <div className="jrow jtog" style={{ paddingLeft: depth * 14 }} onClick={() => setOpen(!open)}>
        <b className={open ? 'open' : ''}>›</b>{label}{label && <i>:</i>}<span className="jc">{arr ? `[${entries.length}]` : `{${entries.length}}`}</span>
      </div>
      {open && entries.slice(0, 500).map(([ck, cv]) => <Node key={ck} k={ck} v={cv} path={jsonPath(path, ck)} depth={depth + 1} q={q} />)}
      {open && entries.length > 500 && <div className="jrow" style={{ paddingLeft: (depth + 1) * 14, color: 'var(--dim)' }}>… +{entries.length - 500}</div>}
    </div>
  )
}

/** Daraltilabilir JSON agaci; anahtara tiklayinca yolu kopyalar, arama eslesen degerleri vurgular. */
export function JsonTree({ value, q = '' }: { value: unknown; q?: string }) {
  return <div className="jtree"><Node k={null} v={value} path="" depth={0} q={q.toLowerCase()} /></div>
}
