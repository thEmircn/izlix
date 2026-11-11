// Sayfa sag-tik menusu tanimi (saf). Ana surec bu tanimi native menuye cevirir; eylemler `act` kimligiyle eslenir.
export interface CtxParams {
  linkURL?: string; srcURL?: string; mediaType?: string; selectionText?: string; isEditable?: boolean; misspelledWord?: string
  dictionarySuggestions?: string[]; pageURL?: string; canGoBack?: boolean; canGoForward?: boolean
  editFlags?: { canCut?: boolean; canCopy?: boolean; canPaste?: boolean; canSelectAll?: boolean }
  engineLabel?: string
  /** menu uretilmeden once sayfadan toplanan baglam (React bileseni, proje klasoru, yuklu tarayicilar...) */
  extra?: CtxExtra
}
export interface CtxExtra { /** sag tiklanan oge tiklanabilir mi (dugme/rol/onclick/imlec) ve bagli adresi (a olmayan: data-href, form action, onclick) */ clickable?: boolean; href?: string; component?: string; editorLabel?: string; hasRoot?: boolean; chrome?: boolean; windows?: number; hasSelector?: boolean }
export type CtxAct =
  | 'back' | 'forward' | 'reload' | 'savePage' | 'print' | 'savePdf' | 'viewSource' | 'inspect' | 'translate' | 'qr'
  | 'linkNewTab' | 'linkNewPrivate' | 'linkCopy' | 'imgNewTab' | 'imgCopy' | 'imgCopyUrl' | 'imgSave' | 'mediaCopyUrl' | 'mediaSave' | 'mediaPip'
  | 'cut' | 'copy' | 'paste' | 'selectAll' | 'search' | 'suggest' | 'addWord'
  | 'speakSel' | 'speakPage' | 'newTab' | 'newWindow' | 'btnNewTab' | 'btnNewWindow' | 'linkNewWindow' | 'linkSplit' | 'linkOtherWin' | 'component' | 'inspectEl' | 'copySel' | 'openRoot' | 'lab' | 'openChrome' | 'openSafari' | 'shotView' | 'shotFull'
export interface CtxItem { act?: CtxAct; label?: string; arg?: string; sep?: true; enabled?: boolean; submenu?: CtxItem[]; /** etiketteki {name}/{editor} yer tutuculari */ vars?: Record<string, string> }
const isHttp = (u?: string): boolean => !!u && /^https?:/i.test(u)

/** Sag-tik hedefine gore madde listesi (etiketler i18n anahtari olarak 'cm.<act>' ile; arg gerekliyse metin) */
export function buildCtxMenu(p: CtxParams): CtxItem[] {
  const out: CtxItem[] = []
  const push = (...x: CtxItem[]): void => { out.push(...x) }
  const sep = (): void => { if (out.length && !out[out.length - 1].sep) out.push({ sep: true }) }
  const e = p.editFlags ?? {}
  const x = p.extra ?? {}
  const page = isHttp(p.pageURL)
  // <a> olmayan tiklanabilir ogeler (dugme, onclick, data-href...): hedef sayfayi yeni sekmede/pencerede ac
  const linkish = isHttp(p.linkURL)
  const btn = page && !p.isEditable && !linkish && !!x.clickable
  if (page && !p.isEditable) {
    // Bu uygulamaya ozgu: sagtikladigin ogenin React bilesenini dogrudan editorde ac (click-to-source)
    if (x.component) push({ act: 'component', arg: x.component, vars: { name: x.component, editor: x.editorLabel ?? 'VS Code' } }, { sep: true })
  }
  if (btn) {
    if (isHttp(x.href)) push({ act: 'linkNewTab', arg: x.href }, { act: 'linkNewWindow', arg: x.href }, { sep: true })
    else push({ act: 'btnNewTab' }, { act: 'btnNewWindow' }, { sep: true })
  }
  if (p.isEditable) {
    if (p.misspelledWord) {
      for (const s of (p.dictionarySuggestions ?? []).slice(0, 5)) push({ act: 'suggest', arg: s, label: s })
      if (!(p.dictionarySuggestions ?? []).length) push({ label: 'cm.noSuggest', enabled: false })
      push({ act: 'addWord', arg: p.misspelledWord }); sep()
    }
    push({ act: 'cut', enabled: !!e.canCut }, { act: 'copy', enabled: !!e.canCopy }, { act: 'paste', enabled: !!e.canPaste }, { act: 'selectAll', enabled: !!e.canSelectAll })
  } else if (p.selectionText?.trim()) {
    push({ act: 'copy' }, { act: 'search', arg: p.selectionText.trim().slice(0, 200) }, { act: 'speakSel' })
  }
  if (isHttp(p.linkURL)) {
    sep(); push({ act: 'linkNewTab', arg: p.linkURL }, { act: 'linkNewPrivate', arg: p.linkURL }, { act: 'linkSplit', arg: p.linkURL })
    push({ act: 'linkNewWindow', arg: p.linkURL })
    push({ act: 'linkCopy', arg: p.linkURL })
  }
  if (p.mediaType === 'image' && p.srcURL) { sep(); push({ act: 'imgNewTab', arg: p.srcURL }, { act: 'imgCopy' }, { act: 'imgCopyUrl', arg: p.srcURL }, { act: 'imgSave', arg: p.srcURL }) }
  if ((p.mediaType === 'video' || p.mediaType === 'audio') && isHttp(p.srcURL)) { sep(); push({ act: 'mediaCopyUrl', arg: p.srcURL }, { act: 'mediaSave', arg: p.srcURL }); if (p.mediaType === 'video') push({ act: 'mediaPip' }) }
  if (page && !p.isEditable) { sep(); push({ act: 'newTab' }, { act: 'newWindow' }) }
  if (!p.isEditable && !p.selectionText?.trim() && !isHttp(p.linkURL) && p.mediaType !== 'image') {
    sep(); push({ act: 'back', enabled: !!p.canGoBack }, { act: 'forward', enabled: !!p.canGoForward }, { act: 'reload' })
  }
  if (page) {
    sep(); push({ act: 'savePage' }, { act: 'print' }, { act: 'savePdf' }, { act: 'translate' }, { act: 'speakPage' }, { act: 'qr' })
    // Gelistirici alt menusu
    const dev: CtxItem[] = []
    if (x.component && p.isEditable) dev.push({ act: 'component', arg: x.component, vars: { name: x.component, editor: x.editorLabel ?? 'VS Code' } })
    dev.push({ act: 'inspectEl' }, { act: 'copySel', enabled: !!x.hasSelector })
    if (x.hasRoot) dev.push({ act: 'openRoot', vars: { editor: x.editorLabel ?? 'VS Code' } })
    dev.push({ sep: true }, { act: 'lab' }, { act: 'shotView' }, { act: 'shotFull' })
    dev.push({ sep: true })
    if (x.chrome) dev.push({ act: 'openChrome' })
    dev.push({ act: 'openSafari' })
    sep(); push({ label: 'cm.dev', submenu: dev })
  }
  sep(); push({ act: 'viewSource' }, { act: 'inspect' })
  while (out.length && out[out.length - 1].sep) out.pop()
  return out
}
