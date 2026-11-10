import type { Language } from './events'

// Arayuz metinleri i18n anahtarlariyla yazilir (plan: Ingilizce baslar, Turkce ikinci dil). {name} yer tutucular desteklenir.
const en = {
  'tab.close': 'Close tab', 'tab.new': 'New tab', 'tabs.none': 'No tabs. Press ＋ to open one.',
  'nav.back': 'Back', 'nav.forward': 'Forward', 'nav.reload': 'Reload', 'addr.placeholder': 'Search or enter address (localhost:5173)',
  'bookmark': 'Bookmark', 'bookmark.title': 'Bookmark (⌘D)',
  'rules.badge': '⚡ {n} rules', 'rules.badge.title': 'Request Rules active — click to edit',
  'ws.fromFolder': '＋ Workspace from folder…', 'workspace': 'Workspace',
  'dock.right': 'DevTools right', 'dock.bottom': 'DevTools bottom', 'dock.off': 'DevTools off', 'devtools': 'DevTools',
  'dl.busy': '⬇ {n} downloading', 'dl.count': '⬇ {n}',
  'lab.title': 'Responsive Lab', 'lab.exit': 'Exit', 'lab.hint': '⌘K → “Responsive Lab” to add/remove devices · scroll, click and typing sync across all views',
  'pal.placeholder': 'Search commands, tabs, workspaces…', 'pal.none': 'No matches',
  'tl.timeline': 'Timeline', 'tl.components': 'Components', 'tl.renders': 'Renders', 'tl.raw': 'Raw', 'tl.allRequests': 'all requests', 'tl.live': 'live',
  'tl.hint': 'Click an event. Drag to select a time range. Solid arrow = exact link, dashed arrow = estimated.',
  'tl.modified': '⚡ Modified by Request Rules: {kinds}', 'tl.mockedRes': ' (mocked response)', 'tl.source': 'source', 'tl.exact': 'exact', 'tl.estimated': 'estimated',
  'tl.col.component': 'component', 'tl.col.reason': 'reason', 'tl.col.changed': 'changed', 'tl.col.ms': 'ms', 'tl.col.source': 'source',
  'insp.search': 'Search components…', 'insp.auto': 'auto', 'insp.refresh': 'Refresh', 'insp.count': '{n} components', 'insp.pick': 'Select a component: props, state, hooks and source appear here.', 'insp.loading': 'loading…',
  'insp.lastRender': 'last render {ms} ms', 'insp.props': 'props', 'insp.state': 'state', 'insp.hooks': 'hooks',
  'trk.component': 'component', 'trk.renders': 'renders', 'trk.total': 'total ms', 'trk.max': 'max ms', 'trk.reason': 'reason', 'trk.changed': 'changed', 'trk.wasted': 'wasted?', 'trk.source': 'source', 'trk.empty': 'No render records yet. Interact with the page.',
  'rr.title': 'Request Rules — {ws}', 'rr.add': '＋ Rule', 'rr.save': 'Save', 'rr.close': 'Close', 'rr.domains': 'Page domains where rules may run',
  'rr.domainsHint': 'Rules apply only to requests made by pages on these domains. Use * as a wildcard in patterns; a pattern without * matches anywhere in the URL.',
  'rr.allMethods': 'all methods', 'rr.pattern': 'URL pattern (/api/users or https://api.x.com/*)', 'rr.enabled': 'Enabled', 'rr.delete': 'Delete',
  'rr.none': 'No rules yet. Use “＋ Rule” to add one.', 'rr.delay': 'delay (ms)', 'rr.status': 'status code', 'rr.statusHint': '(real response body is kept)', 'rr.headersAdd': 'Headers to add', 'rr.headersHint': 'Name: value (one per line)', 'rr.headersRemove': 'Headers to remove', 'rr.headersRemoveHint': 'headers to remove (comma separated)', 'rr.mockStatus': 'status',
  'welcome.title': 'Welcome to Izlix', 'welcome.body': 'See the cause of a bug from the click to the render on one timeline, then open its source in your editor with one click.',
  'welcome.step1': 'Open the demo, press “Load items”, and watch click → request → response → render appear on the Timeline.',
  'welcome.demo': 'Open the demo', 'welcome.skip': 'Skip', 'welcome.telemetry': 'Help improve the product with anonymous usage counts (feature usage and performance numbers only — never URLs or page content). Nothing is sent unless you allow it.',
  'welcome.allow': 'Allow', 'welcome.deny': 'No thanks', 'welcome.done': 'Done',
  'cmd.newTab': 'New Tab', 'cmd.closeTab': 'Close Tab', 'cmd.reload': 'Reload Page', 'cmd.back': 'Go Back', 'cmd.forward': 'Go Forward', 'cmd.focusAddr': 'Focus Address Bar',
  'cmd.rules': 'Request Rules: Edit…', 'cmd.wsNew': 'Workspace: New from Folder…', 'cmd.tlClear': 'Timeline: Clear Selection', 'cmd.bookmark': 'Bookmark: Toggle This Page', 'cmd.report': 'Bug Report: Export zip',
  'cmd.demo': 'Open Demo Project', 'cmd.welcome': 'Show Welcome', 'cmd.language': 'Language: Switch to {lang}', 'cmd.telemetryOn': 'Telemetry: Allow anonymous usage counts', 'cmd.telemetryOff': 'Telemetry: Turn off',
  'cmd.labStart': 'Responsive Lab: Start (iPhone SE + iPad mini + Laptop)', 'cmd.labStartWith': 'Responsive Lab: Start with {d}', 'cmd.labExit': 'Responsive Lab: Exit', 'cmd.labAdd': 'Responsive Lab: Add {d}', 'cmd.labRemove': 'Responsive Lab: Remove {d}',
  'cmd.dockHide': 'DevTools: Hide', 'cmd.dockAt': 'DevTools: Dock {pos}', 'cmd.tab': 'Tab: {t}', 'cmd.workspace': 'Workspace: {w}', 'cmd.bookmarkItem': 'Bookmark: {t}', 'cmd.download': 'Download: {t}', 'cmd.history': 'History: {t}', 'cmd.openServer': 'Open localhost:{port}{fw}',
  'cmd.ruleOff': 'Rule: Disable “{n}”', 'cmd.ruleOn': 'Rule: Enable “{n}”'
} as const

export type Key = keyof typeof en

const tr: Record<Key, string> = {
  'tab.close': 'Sekmeyi kapat', 'tab.new': 'Yeni sekme', 'tabs.none': 'Sekme yok. ＋ ile aç.',
  'nav.back': 'Geri', 'nav.forward': 'İleri', 'nav.reload': 'Yenile', 'addr.placeholder': 'Adres ara ya da gir (localhost:5173)',
  'bookmark': 'Yer imi', 'bookmark.title': 'Yer imi (⌘D)',
  'rules.badge': '⚡ {n} kural', 'rules.badge.title': 'Request Rules etkin — düzenlemek için tıkla',
  'ws.fromFolder': '＋ Klasörden Workspace…', 'workspace': 'Workspace',
  'dock.right': 'DevTools sağda', 'dock.bottom': 'DevTools altta', 'dock.off': 'DevTools kapalı', 'devtools': 'DevTools',
  'dl.busy': '⬇ {n} iniyor', 'dl.count': '⬇ {n}',
  'lab.title': 'Responsive Lab', 'lab.exit': 'Çık', 'lab.hint': '⌘K → “Responsive Lab” ile cihaz ekle/çıkar · kaydırma, tıklama ve yazma tüm görünümlerde eşzamanlı',
  'pal.placeholder': 'Komut, sekme veya Workspace ara…', 'pal.none': 'Eşleşme yok',
  'tl.timeline': 'Timeline', 'tl.components': 'Bileşenler', 'tl.renders': 'Renderlar', 'tl.raw': 'Ham', 'tl.allRequests': 'tüm istekler', 'tl.live': 'canlı',
  'tl.hint': 'Bir olaya tıkla. Sürükleyerek zaman aralığı seç. Düz ok = kesin, kesikli ok = tahmini bağ.',
  'tl.modified': '⚡ Request Rules ile değiştirildi: {kinds}', 'tl.mockedRes': ' (yanıt mock)', 'tl.source': 'kaynak', 'tl.exact': 'kesin', 'tl.estimated': 'tahmini',
  'tl.col.component': 'bileşen', 'tl.col.reason': 'neden', 'tl.col.changed': 'değişen', 'tl.col.ms': 'ms', 'tl.col.source': 'kaynak',
  'insp.search': 'Bileşen ara…', 'insp.auto': 'otomatik', 'insp.refresh': 'Yenile', 'insp.count': '{n} bileşen', 'insp.pick': 'Bir bileşen seç: props, state, hooks ve kaynak burada.', 'insp.loading': 'yükleniyor…',
  'insp.lastRender': 'son render {ms} ms', 'insp.props': 'props', 'insp.state': 'state', 'insp.hooks': 'hooks',
  'trk.component': 'bileşen', 'trk.renders': 'render', 'trk.total': 'toplam ms', 'trk.max': 'maks ms', 'trk.reason': 'neden', 'trk.changed': 'değişen', 'trk.wasted': 'gereksiz?', 'trk.source': 'kaynak', 'trk.empty': 'Henüz render kaydı yok. Sayfayla etkileş.',
  'rr.title': 'Request Rules — {ws}', 'rr.add': '＋ Kural', 'rr.save': 'Kaydet', 'rr.close': 'Kapat', 'rr.domains': 'Kuralların çalışacağı sayfa alan adları',
  'rr.domainsHint': 'Kurallar yalnızca bu alan adlarındaki sayfalardan çıkan isteklere uygulanır. Kalıpta * joker; jokersiz kalıp URL içinde aranır.',
  'rr.allMethods': 'tüm yöntemler', 'rr.pattern': 'URL kalıbı (/api/users veya https://api.x.com/*)', 'rr.enabled': 'Etkin', 'rr.delete': 'Sil',
  'rr.none': 'Henüz kural yok. “＋ Kural” ile ekle.', 'rr.delay': 'gecikme (ms)', 'rr.status': 'durum kodu', 'rr.statusHint': '(gerçek yanıt gövdesi korunur)', 'rr.headersAdd': 'Eklenecek header\'lar', 'rr.headersHint': 'Ad: değer (satır başına bir tane)', 'rr.headersRemove': 'Silinecek header\'lar', 'rr.headersRemoveHint': 'silinecek header\'lar (virgülle)', 'rr.mockStatus': 'durum',
  'welcome.title': 'Izlix\'a hoş geldin', 'welcome.body': 'Bir hatanın sebebini tıklamadan render\'a kadar tek zaman çizelgesinde gör, kaynağını tek tıkla editöründe aç.',
  'welcome.step1': 'Demoyu aç, “Load items”a bas ve Timeline\'da tıklama → istek → yanıt → render zincirinin belirdiğini izle.',
  'welcome.demo': 'Demoyu aç', 'welcome.skip': 'Atla', 'welcome.telemetry': 'Ürünü geliştirmeye anonim kullanım sayılarıyla yardım et (yalnızca özellik kullanımı ve performans sayıları — asla URL veya sayfa içeriği). İzin vermedikçe hiçbir şey gönderilmez.',
  'welcome.allow': 'İzin ver', 'welcome.deny': 'Hayır, teşekkürler', 'welcome.done': 'Tamam',
  'cmd.newTab': 'Yeni Sekme', 'cmd.closeTab': 'Sekmeyi Kapat', 'cmd.reload': 'Sayfayı Yenile', 'cmd.back': 'Geri Git', 'cmd.forward': 'İleri Git', 'cmd.focusAddr': 'Adres Çubuğuna Odaklan',
  'cmd.rules': 'Request Rules: Düzenle…', 'cmd.wsNew': 'Workspace: Klasörden Yeni…', 'cmd.tlClear': 'Timeline: Seçimi Temizle', 'cmd.bookmark': 'Yer imi: Bu Sayfayı Ekle/Çıkar', 'cmd.report': 'Hata Raporu: Zip Dışa Aktar',
  'cmd.demo': 'Demo Projesini Aç', 'cmd.welcome': 'Karşılama Ekranını Göster', 'cmd.language': 'Dil: {lang} yap', 'cmd.telemetryOn': 'Telemetri: Anonim kullanım sayılarına izin ver', 'cmd.telemetryOff': 'Telemetri: Kapat',
  'cmd.labStart': 'Responsive Lab: Başlat (iPhone SE + iPad mini + Laptop)', 'cmd.labStartWith': 'Responsive Lab: {d} ile başlat', 'cmd.labExit': 'Responsive Lab: Çık', 'cmd.labAdd': 'Responsive Lab: {d} ekle', 'cmd.labRemove': 'Responsive Lab: {d} çıkar',
  'cmd.dockHide': 'DevTools: Gizle', 'cmd.dockAt': 'DevTools: {pos} yerleştir', 'cmd.tab': 'Sekme: {t}', 'cmd.workspace': 'Workspace: {w}', 'cmd.bookmarkItem': 'Yer imi: {t}', 'cmd.download': 'İndirme: {t}', 'cmd.history': 'Geçmiş: {t}', 'cmd.openServer': 'localhost:{port} aç{fw}',
  'cmd.ruleOff': 'Kural: “{n}” kapat', 'cmd.ruleOn': 'Kural: “{n}” aç'
}

const dicts: Record<Language, Record<string, string>> = { en, tr }

export function translate(lang: Language, key: Key, vars?: Record<string, string | number>): string {
  const s = dicts[lang][key] ?? en[key] ?? key
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? `{${k}}`)) : s
}
export const keys = Object.keys(en) as Key[]
