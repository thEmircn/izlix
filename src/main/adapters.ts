import { BINDING, BRIDGE_SOURCE } from './react-bridge'

/**
 * Framework adaptoru (plan K-05): her framework icin sayfaya enjekte edilen bir kopru betigi.
 * SOZLESME (adaptor ne yaparsa yapsin):
 *  - Olaylari `window.<BINDING>(JSON)` ile bildirir; mesaj tipleri: `commit` (render), `input`, `fetch-start`, `inject`, `bridge-error`.
 *  - Istege bagli: `window.__IZLIX_TREE__()` -> { nodes: [{ id, depth, name, t?, key? }], truncated }
 *    ve `window.__IZLIX_INSPECT__(id)` -> { name, props, state?, hooks?, src?, ms? } (Inspector bunlari cagirir).
 *  - Bilesen konumu icin `c.src` ("dosya:satir:sutun") veya `c.t` (tip kimligi -> source map cozumlemesi) saglar.
 * Vue ve Svelte adaptorleri v1.0 sonrasi bu arayuzle eklenir; olay modeli ve Timeline degismez.
 */
export interface FrameworkAdapter {
  id: string
  label: string
  /** sayfa belgesi olusurken calistirilacak betik */
  script: string
}

export const reactAdapter: FrameworkAdapter = { id: 'react', label: 'React 18/19', script: BRIDGE_SOURCE }

/** Etkin adaptorler; tumu her sayfaya enjekte edilir (her biri kendi framework'unu yoksa sessiz kalir). */
export const ADAPTERS: FrameworkAdapter[] = [reactAdapter]
export { BINDING }
