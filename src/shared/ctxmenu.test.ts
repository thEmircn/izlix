import { describe, expect, it } from 'vitest'
import { buildCtxMenu, type CtxItem } from './ctxmenu'
const acts = (l: CtxItem[]): string[] => l.map((x) => (x.sep ? '-' : (x.act ?? x.label ?? '')))

describe('buildCtxMenu', () => {
  it('bos sayfa: gezinme + sayfa eylemleri + kaynak/inceleme; ayirac duzgun', () => {
    const l = buildCtxMenu({ pageURL: 'https://a.com/', canGoBack: true })
    expect(acts(l)).toEqual(['back', 'forward', 'reload', '-', 'savePage', 'print', 'savePdf', 'translate', 'qr', '-', 'viewSource', 'inspect'])
    expect(l[0].enabled).toBe(true); expect(l[1].enabled).toBe(false)
  })
  it('baglanti: yeni sekme/gizli/kopyala; yalniz http(s)', () => {
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', linkURL: 'https://b.com/x' }))).toContain('linkNewTab')
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', linkURL: 'javascript:alert(1)' }))).not.toContain('linkNewTab')
  })
  it('secili metin: kopyala + ara; duzenlenebilir alan: kes/kopyala/yapistir; yazim onerileri', () => {
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', selectionText: ' kedi ' })).slice(0, 2)).toEqual(['copy', 'search'])
    const l = buildCtxMenu({ pageURL: 'https://a.com/', isEditable: true, misspelledWord: 'mrb', dictionarySuggestions: ['merhaba', 'mırıl'], editFlags: { canPaste: true } })
    expect(acts(l).slice(0, 7)).toEqual(['suggest', 'suggest', 'addWord', '-', 'cut', 'copy', 'paste'])
    expect(l.find((x) => x.act === 'paste')!.enabled).toBe(true); expect(l.find((x) => x.act === 'cut')!.enabled).toBe(false)
  })
  it('resim ve video menusu; gezinme maddeleri gorunmez', () => {
    const img = acts(buildCtxMenu({ pageURL: 'https://a.com/', mediaType: 'image', srcURL: 'https://a.com/i.png' }))
    expect(img).toContain('imgSave'); expect(img).not.toContain('back')
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', mediaType: 'video', srcURL: 'https://a.com/v.mp4' }))).toContain('mediaPip')
  })
  it('dosya/about sayfasinda sayfa eylemleri yok', () => {
    expect(acts(buildCtxMenu({ pageURL: 'about:blank' }))).not.toContain('print')
  })
})
