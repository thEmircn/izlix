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
  /** Bolunmus gorunumde sekmenin tarafi */
  split?: 'left' | 'right'
  id: string
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
export interface Settings { /** adres cubugu arama motoru kimligi (shared/search.ts) */ searchEngine?: string; telemetry: 'unset' | 'granted' | 'denied'; onboarded: boolean; language: Language; installId: string; /** Workspace'e ait yeni dev sunucusu baslayinca sekme ac */ autoOpen: boolean }
