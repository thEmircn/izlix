import { useEffect, useState } from 'react'
import { NOTE_COLORS, type Note } from '../shared/notes'
import { useStore, useT, toast } from './store'
import { Kbd } from './ui'

/** Vurguya not yaz/duzenle (sag tik > Not ekle). */
export function NotePrompt({ onClose }: { onClose(): void }) {
  const t = useT()
  const ask = useStore((s) => s.noteAsk)!
  const [text, setText] = useState(ask.existing)
  const save = (): void => { void window.izlix.noteSave(ask.tempId, text).then(() => { toast(t('site.saved')); onClose() }) }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog" role="dialog" aria-label={t('notes.add')} style={{ width: 'min(480px, 92vw)' }} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose(); if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) save() }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}><b style={{ flex: 1, fontSize: 14 }}>{t('notes.add')}</b><Kbd>⌘↵</Kbd></div>
        <div style={{ padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <blockquote className="note-quote" style={{ background: NOTE_COLORS.yellow + '55' }}>{ask.text.slice(0, 240)}</blockquote>
          <textarea autoFocus value={text} rows={4} placeholder={t('notes.placeholder')} onChange={(e) => setText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}><button className="btn primary" onClick={save}>{t('site.save')}</button><button className="btn" onClick={onClose}>{t('dlg.cancel')}</button></div>
        </div>
      </div>
    </div>
  )
}

/** Tum notlar ve vurgular (sayfaya gore gruplu): ac, sil. */
export function NotesPage({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const tabId = useStore((s) => s.activeTabId)
  const [list, setList] = useState<Note[]>([])
  const [q, setQ] = useState('')
  const load = (): void => { void api.noteList().then((l: Note[]) => setList(l ?? [])) }
  useEffect(load, [])
  const ql = q.trim().toLowerCase()
  const shown = list.filter((n) => !ql || n.text.toLowerCase().includes(ql) || (n.note ?? '').toLowerCase().includes(ql) || n.url.toLowerCase().includes(ql))
  const groups = shown.reduce<Record<string, Note[]>>((m, n) => { (m[n.url] ??= []).push(n); return m }, {})
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog dl" role="dialog" aria-label={t('notes.title')} onMouseDown={(e) => e.stopPropagation()} onKeyDown={(e) => { if (e.key === 'Escape') onClose() }}>
        <div className="hist-head"><b>{t('notes.title')}</b><input value={q} spellCheck={false} placeholder={t('notes.search')} onChange={(e) => setQ(e.target.value)} /><Kbd>esc</Kbd></div>
        <div className="dl-list">
          {shown.length === 0 && <div className="hub-empty">{t('notes.empty')}</div>}
          {Object.entries(groups).map(([url, items]) => (
            <section key={url}>
              <h4 className="note-page" title={url} onClick={() => { if (tabId) void api.go(tabId, url); else void api.createTab(url); onClose() }}>{url.replace(/^https?:\/\//, '')}</h4>
              {items.map((n) => (
                <div className="note-row" key={n.id}>
                  <div style={{ flex: 1, minWidth: 0 }}><mark style={{ background: (NOTE_COLORS[n.color] ?? NOTE_COLORS.yellow) + 'cc', color: '#111', borderRadius: 3, padding: '0 3px' }}>{n.text.slice(0, 200)}</mark>{n.note && <p>{n.note}</p>}</div>
                  <button className="hist-x" style={{ opacity: 1 }} aria-label={t('bm.delete')} title={t('bm.delete')} onClick={() => void api.noteDelete(n.id).then(load)}>×</button>
                </div>
              ))}
            </section>
          ))}
        </div>
      </div>
    </div>
  )
}
