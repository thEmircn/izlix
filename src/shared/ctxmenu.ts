// Sayfa sag-tik menusu tanimi (saf). Ana surec bu tanimi native menuye cevirir; eylemler `act` kimligiyle eslenir.
export interface CtxParams {
  linkURL?: string; srcURL?: string; mediaType?: string; selectionText?: string; isEditable?: boolean; misspelledWord?: string
  dictionarySuggestions?: string[]; pageURL?: string; canGoBack?: boolean; canGoForward?: boolean
  editFlags?: { canCut?: boolean; canCopy?: boolean; canPaste?: boolean; canSelectAll?: boolean }
  engineLabel?: string
}
export type CtxAct =
  | 'back' | 'forward' | 'reload' | 'savePage' | 'print' | 'savePdf' | 'viewSource' | 'inspect' | 'translate' | 'qr'
  | 'linkNewTab' | 'linkNewPrivate' | 'linkCopy' | 'imgNewTab' | 'imgCopy' | 'imgCopyUrl' | 'imgSave' | 'mediaCopyUrl' | 'mediaSave' | 'mediaPip'
  | 'cut' | 'copy' | 'paste' | 'selectAll' | 'search' | 'suggest' | 'addWord'
export interface CtxItem { act?: CtxAct; label?: string; arg?: string; sep?: true; enabled?: boolean }
const isHttp = (u?: string): boolean => !!u && /^https?:/i.test(u)

/** Sag-tik hedefine gore madde listesi (etiketler i18n anahtari olarak 'cm.<act>' ile; arg gerekliyse metin) */
export function buildCtxMenu(p: CtxParams): CtxItem[] {
  const out: CtxItem[] = []
  const push = (...x: CtxItem[]): void => { out.push(...x) }
  const sep = (): void => { if (out.length && !out[out.length - 1].sep) out.push({ sep: true }) }
  const e = p.editFlags ?? {}
  if (p.isEditable) {
    if (p.misspelledWord) {
      for (const s of (p.dictionarySuggestions ?? []).slice(0, 5)) push({ act: 'suggest', arg: s, label: s })
      if (!(p.dictionarySuggestions ?? []).length) push({ label: 'cm.noSuggest', enabled: false })
      push({ act: 'addWord', arg: p.misspelledWord }); sep()
    }
    push({ act: 'cut', enabled: !!e.canCut }, { act: 'copy', enabled: !!e.canCopy }, { act: 'paste', enabled: !!e.canPaste }, { act: 'selectAll', enabled: !!e.canSelectAll })
  } else if (p.selectionText?.trim()) {
    push({ act: 'copy' }, { act: 'search', arg: p.selectionText.trim().slice(0, 200) })
  }
  if (isHttp(p.linkURL)) { sep(); push({ act: 'linkNewTab', arg: p.linkURL }, { act: 'linkNewPrivate', arg: p.linkURL }, { act: 'linkCopy', arg: p.linkURL }) }
  if (p.mediaType === 'image' && p.srcURL) { sep(); push({ act: 'imgNewTab', arg: p.srcURL }, { act: 'imgCopy' }, { act: 'imgCopyUrl', arg: p.srcURL }, { act: 'imgSave', arg: p.srcURL }) }
  if ((p.mediaType === 'video' || p.mediaType === 'audio') && isHttp(p.srcURL)) { sep(); push({ act: 'mediaCopyUrl', arg: p.srcURL }, { act: 'mediaSave', arg: p.srcURL }); if (p.mediaType === 'video') push({ act: 'mediaPip' }) }
  if (!p.isEditable && !p.selectionText?.trim() && !isHttp(p.linkURL) && p.mediaType !== 'image') {
    sep(); push({ act: 'back', enabled: !!p.canGoBack }, { act: 'forward', enabled: !!p.canGoForward }, { act: 'reload' })
  }
  if (isHttp(p.pageURL)) {
    sep(); push({ act: 'savePage' }, { act: 'print' }, { act: 'savePdf' }, { act: 'translate' }, { act: 'qr' })
  }
  sep(); push({ act: 'viewSource' }, { act: 'inspect' })
  while (out.length && out[out.length - 1].sep) out.pop()
  return out
}
