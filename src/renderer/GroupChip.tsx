import { useState } from 'react'
import { GROUP_COLORS, type TabGroup } from '../shared/groups'
import { useT } from './store'

/** Sekme grubu basligi: renkli hap; tikla daralt/ac, cift tikla yeniden adlandir, sag tikla renk/dagit/kapat. */
export function GroupChip({ g, count }: { g: TabGroup; count: number }) {
  const t = useT()
  const api = window.izlix
  const [edit, setEdit] = useState<string | null>(null)
  const color = GROUP_COLORS[g.color] ?? GROUP_COLORS.grey
  const commit = (): void => { if (edit !== null) void api.updateGroup(g.id, { name: edit.trim() }); setEdit(null) }
  return (
    <div className={`gchip nodrag ${g.collapsed ? 'collapsed' : ''}`} style={{ ['--gc' as any]: color }} title={g.name || t('grp.name')}
      onClick={() => { if (edit === null) void api.updateGroup(g.id, { collapsed: !g.collapsed }) }} onDoubleClick={() => setEdit(g.name)} onContextMenu={(e) => { e.preventDefault(); void api.groupMenu(g.id) }}>
      {edit !== null
        ? <input autoFocus value={edit} maxLength={40} placeholder={t('grp.name')} onClick={(e) => e.stopPropagation()} onChange={(e) => setEdit(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') commit(); if (e.key === 'Escape') setEdit(null) }} />
        : <><i />{g.name && <span>{g.name}</span>}{g.collapsed && <em>{count}</em>}</>}
    </div>
  )
}
