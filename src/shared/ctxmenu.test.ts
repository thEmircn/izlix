import { describe, expect, it } from 'vitest'
import { buildCtxMenu, type CtxItem } from './ctxmenu'
const acts = (l: CtxItem[]): string[] => l.map((x) => (x.sep ? '-' : (x.act ?? x.label ?? '')))

describe('buildCtxMenu', () => {
  it('bos sayfa: gezinme + sayfa eylemleri + kaynak/inceleme; ayirac duzgun', () => {
    const l = buildCtxMenu({ pageURL: 'https://a.com/', canGoBack: true })
    expect(acts(l)).toEqual(['newTab', 'newWindow', '-', 'back', 'forward', 'reload', '-', 'savePage', 'print', 'savePdf', 'translate', 'speakPage', 'qr', '-', 'cm.dev', '-', 'viewSource', 'inspect'])
    const b = l.filter((x) => x.act === 'back' || x.act === 'forward'); expect(b[0].enabled).toBe(true); expect(b[1].enabled).toBe(false)
  })
  it('baglanti: yeni sekme/gizli/kopyala; yalniz http(s)', () => {
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', linkURL: 'https://b.com/x' }))).toContain('linkNewTab')
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', linkURL: 'javascript:alert(1)' }))).not.toContain('linkNewTab')
  })
  it('secili metin: kopyala + ara; duzenlenebilir alan: kes/kopyala/yapistir; yazim onerileri', () => {
    expect(acts(buildCtxMenu({ pageURL: 'https://a.com/', selectionText: ' kedi ' })).slice(0, 3)).toEqual(['copy', 'search', 'speakSel'])
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
  it('React bileseni bulunursa en ustte editorde ac; adlandirma degiskenleri', () => {
    const l = buildCtxMenu({ pageURL: 'https://a.com/', extra: { component: 'PayButton', editorLabel: 'Cursor' } })
    expect(l[0]).toMatchObject({ act: 'component', vars: { name: 'PayButton', editor: 'Cursor' } })
    expect(buildCtxMenu({ pageURL: 'https://a.com/' }).some((x) => x.act === 'component')).toBe(false)
  })
  it('gelistirici alt menusu: proje klasoru ve Chrome yalniz varsa; secici kopyalama etkinligi', () => {
    const dev = (x: any) => buildCtxMenu({ pageURL: 'http://localhost:5173/', extra: x }).find((i) => i.label === 'cm.dev')!.submenu!
    const a = dev({ hasRoot: true, chrome: true, hasSelector: true }).map((i) => i.act ?? '-')
    expect(a).toEqual(['inspectEl', 'copySel', 'openRoot', '-', 'lab', 'shotView', 'shotFull', '-', 'openChrome', 'openSafari'])
    const b = dev({}).map((i) => i.act ?? '-'); expect(b).not.toContain('openRoot'); expect(b).not.toContain('openChrome')
    expect(dev({}).find((i) => i.act === 'copySel')!.enabled).toBe(false)
  })
  it('baglantida bolunmus gorunumde ac; ikinci pencere varsa diger pencerede ac', () => {
    const a = (w: number) => acts(buildCtxMenu({ pageURL: 'https://a.com/', linkURL: 'https://b.com/', extra: { windows: w } }))
    expect(a(1)).toContain('linkSplit'); expect(a(1)).toContain('linkNewWindow'); expect(a(2)).toContain('linkNewWindow')
  })
  it('tiklanabilir dugme: adres bilinmiyorsa tiklamayi yonlendiren maddeler; biliniyorsa dogrudan baglanti maddeleri; duzenlenebilirde yok', () => {
    const a = (x: any, extra: any = {}) => acts(buildCtxMenu({ pageURL: 'https://a.com/', ...extra, extra: x }))
    expect(a({ clickable: true }).slice(0, 2)).toEqual(['btnNewTab', 'btnNewWindow'])
    expect(a({ clickable: true, href: 'https://a.com/x' }).slice(0, 2)).toEqual(['linkNewTab', 'linkNewWindow'])
    expect(a({ clickable: true }, { isEditable: true })).not.toContain('btnNewTab')
    expect(a({ clickable: true }, { linkURL: 'https://b.com/' })).not.toContain('btnNewTab')
    expect(a({})).not.toContain('btnNewTab')
  })
})
