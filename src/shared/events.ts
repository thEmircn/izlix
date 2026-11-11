// Olay modeli (plan bolum 4): her olay ayni semayi tasir.
export type EventKind =
  | 'input' | 'state' | 'request' | 'response' | 'render'
  | 'console' | 'error' | 'navigation' | 'hmr' | 'vital' | 'ws' | 'marker'

export type Certainty = 'exact' | 'estimated'
export interface Link { from: number; certainty: Certainty; type: string }

export interface BusEvent {
  id: number
  tabId: string
  /** epoch milisaniye; tum kaynaklar (CDP monotonik, CDP epoch, sayfa saati) bu eksene normalize edilir */
  ts: number
  kind: EventKind
  source: string
  payload: Record<string, any>
  causeIds: number[]
  links: Link[]
}

export interface SessionInfo { id: string; name: string; ts: number; tabs: { url: string; title: string }[]; active: number; split: [number, number] | null }
export interface TabInfo {
  /** Bu site icin kayitli giris sayisi (sifre yoneticisi) */
  logins?: number
  /** Bu sitenin kayitli ayarlari (zoom/karanlik) */
  site?: { zoom?: number; dark?: boolean }
  /** Sekme grubu kimligi (TabGroup.id) */
  group?: string
  /** Sekme ses caliyor / sessize alinmis */
  audible?: boolean
  muted?: boolean
  /** Uyuyan sekme: sayfa sureci kapatildi (bellek), secilince ayni adresle yeniden yuklenir */
  sleeping?: boolean
  /** Sabitlenmis sekme: seridin basinda, dar; oturumla geri gelir */
  pinned?: boolean
  /** Gizli sekme: kalici olmayan, izole oturum; gecmis/oturum kaydi yok */
  private?: 'incognito' | 'tor'
  /** Bolunmus gorunumde sekmenin tarafi */
  split?: 'left' | 'right'
  id: string
  /** sekmenin gosterildigi pencere */
  winId?: number
  workspaceId: string
  title: string
  url: string
  loading: boolean
  canGoBack: boolean
  canGoForward: boolean
  /** Responsive Lab acikken cihaz kimlikleri (ilki birincil gorunum) */
  lab?: string[]
  /** Emulasyon: acik/koyu tema ve azaltilmis hareket (Emulation.setEmulatedMedia) */
  /** Ag/CPU kisitlama ve konum emulasyonu */
  /** Network.setCacheDisabled */
  noCache?: boolean
  /** bu sayfada engellenen istek sayisi */
  blocked?: number
  emu?: { network?: string; cpu?: number; geo?: string; ua?: string; touch?: boolean; vision?: string; contrast?: 'more' | 'less'; forcedColors?: boolean; print?: boolean }
  media?: { colorScheme?: 'light' | 'dark'; reducedMotion?: boolean }
}

export interface WorkspaceInfo {
  id: string
  name: string
  rootDir: string | null
  /** bu Workspace'e ait, tespit edilmis calisan dev sunucu portlari */
  servers: { port: number; framework?: string }[]
}

export type Editor = 'vscode' | 'cursor' | 'webstorm'
export type DevToolsDock = 'right' | 'bottom' | 'off'

export type Language = 'en' | 'tr'
export interface Settings { /** adres cubugu arama motoru kimligi (shared/search.ts) */ searchEngine?: string; /** yazarken arama motorundan canli oneri al (varsayilan acik; yazilan metin motora gider) */ searchSuggest?: boolean; /** reklam/izleyici engelleme duzeyi (varsayilan ads) */ adblock?: 'off' | 'ads' | 'strict'; /** engelleyicinin kapali oldugu siteler */ adblockAllow?: string[]; /** gelistirme (localhost) sayfalarinda da engelle */ adblockDev?: boolean; /** video ambient isigi (varsayilan acik) */ ambient?: boolean; /** adresteki izleme parametrelerini (utm_, fbclid...) sil (varsayilan acik) */ stripTracking?: boolean; /** yazim denetimi (varsayilan acik) */ spellcheck?: boolean; /** cerez/KVKK bannerlarini otomatik reddet ve gizle (varsayilan acik) */ cookieBanners?: boolean; stripTrackingDev?: boolean; /** hareketsiz sekmeleri bu kadar dakika sonra uyut (0 = kapali, varsayilan 30) */ sleepMinutes?: number; /** gelistirme sayfalarinda da ambient (test) */ ambientDev?: boolean; telemetry: 'unset' | 'granted' | 'denied'; onboarded: boolean; language: Language; installId: string; /** Workspace'e ait yeni dev sunucusu baslayinca sekme ac */ autoOpen: boolean }
