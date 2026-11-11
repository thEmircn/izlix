// Sayfa notlari ve vurgulari (saf): anahtar, sayfa betikleri.
export interface Note { id: string; url: string; text: string; prefix: string; suffix: string; note?: string; color: string; ts: number }
export const NOTE_COLORS: Record<string, string> = { yellow: '#ffe56a', green: '#8be28b', pink: '#ff9ec4', blue: '#8ec5ff' }
/** Sayfa anahtari: hash'siz adres (kisaltilmis); yalniz http(s) */
export function pageKey(url: string): string | null {
  try { const u = new URL(url); return u.protocol === 'http:' || u.protocol === 'https:' ? (u.origin + u.pathname + u.search).slice(0, 500) : null } catch { return null }
}

function captureSelectionInPage(): { text: string; prefix: string; suffix: string } | null {
  const s = window.getSelection(); if (!s || s.isCollapsed || !s.rangeCount) return null
  const text = s.toString().replace(/\s+/g, ' ').trim(); if (text.length < 2 || text.length > 2000) return null
  const r = s.getRangeAt(0), sc = r.startContainer, ec = r.endContainer
  const prefix = (sc.nodeType === 3 ? (sc.textContent ?? '').slice(Math.max(0, r.startOffset - 30), r.startOffset) : '').replace(/\s+/g, ' ')
  const suffix = (ec.nodeType === 3 ? (ec.textContent ?? '').slice(r.endOffset, r.endOffset + 30) : '').replace(/\s+/g, ' ')
  return { text, prefix, suffix }
}
/** Secili metni ve cevresini toplar (secim yoksa null) */
export const CAPTURE_SELECTION = `(${captureSelectionInPage.toString()})()`

/** Sayfa tarafinda calisan fonksiyonlar: gercek JS olarak yazilir ve .toString() ile enjekte edilir (dizge kacisi hatalarini onler). Dis degiskene basvurmamali. */
function applyNotesInPage(notes: { id: string; text: string; prefix: string; suffix: string; note?: string; color: string }[], colors: Record<string, string>): void {
  const collect = (): { nodes: { n: Text; start: number }[]; text: string } => {
    const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, { acceptNode: (n) => (n.parentElement && /^(SCRIPT|STYLE|NOSCRIPT|TEXTAREA)$/.test(n.parentElement.tagName)) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT })
    const nodes: { n: Text; start: number }[] = []; let text = ''
    for (let n = w.nextNode(); n; n = w.nextNode()) { nodes.push({ n: n as Text, start: text.length }); text += (n.textContent ?? '') }
    return { nodes, text }
  }
  for (const note of notes) {
    if (document.querySelector('mark[data-db-note="' + note.id + '"]')) continue
    const { nodes, text } = collect()
    const esc = note.text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&').replace(/ /g, '\\s+')
    const re = new RegExp(esc, 'g')
    let m: RegExpExecArray | null, best: { s: number; e: number } | null = null, bestScore = -1
    while ((m = re.exec(text))) {
      let score = 0
      if (note.prefix && text.slice(Math.max(0, m.index - note.prefix.length - 2), m.index).replace(/\s+/g, ' ').endsWith(note.prefix)) score += 2
      if (note.suffix && text.slice(m.index + m[0].length, m.index + m[0].length + note.suffix.length + 2).replace(/\s+/g, ' ').startsWith(note.suffix)) score += 2
      if (score > bestScore) { bestScore = score; best = { s: m.index, e: m.index + m[0].length } }
      if (m[0].length === 0) re.lastIndex++
    }
    if (!best) continue
    for (const seg of nodes) {
      const len = (seg.n.textContent ?? '').length, a = Math.max(best.s, seg.start), b = Math.min(best.e, seg.start + len)
      if (b <= a) continue
      let node = seg.n
      if (a - seg.start > 0) node = node.splitText(a - seg.start)
      if (b - a < (node.textContent ?? '').length) node.splitText(b - a)
      const mk = document.createElement('mark'); mk.setAttribute('data-db-note', note.id)
      mk.style.cssText = 'background:' + (colors[note.color] || colors.yellow) + ';color:inherit;border-radius:2px;padding:0 1px;'
      if (note.note) mk.title = note.note
      node.parentNode!.replaceChild(mk, node); mk.appendChild(node)
    }
  }
}
function removeNoteInPage(id: string): void {
  for (const m of Array.from(document.querySelectorAll('mark[data-db-note="' + id + '"]'))) {
    const p = m.parentNode!
    while (m.firstChild) p.insertBefore(m.firstChild, m)
    p.removeChild(m); p.normalize()
  }
}
export const applyNotesScript = (notes: Pick<Note, 'id' | 'text' | 'prefix' | 'suffix' | 'note' | 'color'>[]): string => `(${applyNotesInPage.toString()})(${JSON.stringify(notes)}, ${JSON.stringify(NOTE_COLORS)})`
export const removeNoteScript = (id: string): string => `(${removeNoteInPage.toString()})(${JSON.stringify(id)})`
