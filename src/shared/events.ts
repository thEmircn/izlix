// Olay modeli (plan bolum 4): her olay ayni semayi tasir.
export type EventKind =
  | 'input' | 'state' | 'request' | 'response' | 'render'
  | 'console' | 'error' | 'navigation' | 'hmr'

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

export interface TabInfo {
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
export interface Settings { telemetry: 'unset' | 'granted' | 'denied'; onboarded: boolean; language: Language; installId: string }
