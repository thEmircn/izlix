import { useEffect, useState } from 'react'
import { originKey } from '../shared/favicon'
import type { TabHit } from '../shared/tabsearch'
import { useStore, useT } from './store'
import { Kbd } from './ui'

/** Sekme arama + tum sekmelerin ICERIGINDE arama (⇧⌘A / ⇧⌘F): bos sorguda sekme listesi, yazinca eslesme sayisi ve ozetler. */
export function TabSearch({ onClose }: { onClose(): void }) {
  const t = useT()
  const api = window.izlix
  const favicons = useStore((s) => s.favicons)
  const [q, setQ] = useState('')
  const [hits, setHits] = useState<TabHit[]>([])
  const [idx, setIdx] = useState(0)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setBusy(true)
    const h = setTimeout(() => { void api.tabsSearch(q).then((l: TabHit[]) => { setHits(l); setIdx(0); setBusy(false) }).catch(() => setBusy(false)) }, q ? 220 : 0)
    return () => clearTimeout(h)
  }, [q])
  const pick = (h: TabHit | undefined): void => {
    if (!h) return
    onClose(); void api.activateTab(h.id)
    if (q.trim() && h.count > 0) setTimeout(() => { void api.findStart(h.id, q.trim(), true, false) }, 450) // sayfada eslesmeleri vurgula
  }
  return (
    <div className="overlay" onMouseDown={onClose}>
      <div className="dialog ts" role="dialog" aria-label={t('menu.findAllTabs')} onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); else if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => Math.min(hits.length - 1, i + 1)) } else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => Math.max(0, i - 1)) } else if (e.key === 'Enter') pick(hits[idx]) }}>
        <div className="hist-head"><input autoFocus value={q} spellCheck={false} placeholder={t('ts.placeholder')} onChange={(e) => setQ(e.target.value)} /><Kbd>⇧⌘F</Kbd></div>
        <div className="ts-list">
          {hits.length === 0 && !busy && <div className="hub-empty">{t('ts.none')}</div>}
          {hits.map((h, i) => (
            <div key={h.id} className={`ts-row ${i === idx ? 'on' : ''}`} onMouseEnter={() => setIdx(i)} onClick={() => pick(h)}>
              <span className="hist-ic">{favicons[originKey(h.url) ?? ''] ? <img alt="" src={favicons[originKey(h.url) ?? '']} /> : <i />}</span>
              <div className="ts-main"><b>{h.title || h.url}{h.sleeping && <em> · {t('tab.sleepingNote')}</em>}{h.private && <em> · {t('tab.private')}</em>}</b>
                <small>{h.url}</small>
                {h.snippets.map((s, k) => <p key={k}>{s}</p>)}</div>
              {h.count > 0 && <span className="ts-n">{h.count}</span>}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
