// Sayfadaki framework tespiti: hangi framework'ler var, hangisi icin adaptor (bilesen denetcisi) hazir. Saf mantik + sayfaya gonderilen tespit betigi.
export interface Detected { id: string; name: string; version: string; supported: boolean }

/** Adaptoru hazir olan framework'ler (main/adapters.ts ile ayni liste; yeni adaptor eklenince buraya da eklenir). */
export const SUPPORTED_FRAMEWORKS = new Set(['react'])

/** Sayfada (ana dunya) calisir, YALNIZCA okur; dizi doner: [{ id, version }]. Sayfa kontrollu veri: sonuc `parseDetected` ile temizlenir. */
export const DETECT_SCRIPT = `(() => {
  const out = []; const add = (id, version) => out.push({ id, version: String(version || '') });
  try {
    const h = window.__REACT_DEVTOOLS_GLOBAL_HOOK__;
    if (h && h.renderers && h.renderers.size) { let v = ''; h.renderers.forEach((r) => { if (!v && r && r.version) v = r.version; }); add('react', v); }
    else if (document.querySelector('[data-reactroot]')) add('react', '');
  } catch (e) {}
  try { const a = window.__VUE__ || window.__VUE_DEVTOOLS_GLOBAL_HOOK__; const el = document.querySelector('[data-v-app]'); if (a || el || window.Vue) add('vue', (window.Vue && window.Vue.version) || (el && el.__vue_app__ && el.__vue_app__.version) || ''); } catch (e) {}
  try { if (window.__svelte || window.__SVELTE_HMR || document.querySelector('[class*="svelte-"]')) add('svelte', (window.__svelte && window.__svelte.v && [...window.__svelte.v][0]) || ''); } catch (e) {}
  try { const ng = document.querySelector('[ng-version]'); if (ng) add('angular', ng.getAttribute('ng-version')); else if (window.ng && window.getAllAngularRootElements) add('angular', ''); } catch (e) {}
  try { if (window.next || window.__NEXT_DATA__ || document.getElementById('__next') || document.querySelector('next-route-announcer')) add('next', (window.next && window.next.version) || ''); } catch (e) {}
  try { if (document.querySelector('script[src*="/@vite/client"]') || window.__vite_plugin_react_preamble_installed__ !== undefined) add('vite', ''); } catch (e) {}
  return out;
})()`

const NAMES: Record<string, string> = { react: 'React', vue: 'Vue', svelte: 'Svelte', angular: 'Angular', next: 'Next.js', vite: 'Vite' }
const COMPONENT_FRAMEWORKS = new Set(['react', 'vue', 'svelte', 'angular'])

/** Sayfadan gelen ham sonucu guvenli, sinirli bir listeye cevirir (bilinmeyen kimlikler, uzun/tuhaf surumler atilir). */
export function parseDetected(raw: unknown): Detected[] {
  if (!Array.isArray(raw)) return []
  const seen = new Set<string>(), out: Detected[] = []
  for (const x of raw.slice(0, 12)) {
    const id = typeof x?.id === 'string' ? x.id : ''
    if (!NAMES[id] || seen.has(id)) continue
    seen.add(id)
    const v = typeof x.version === 'string' && /^[\w.+-]{1,24}$/.test(x.version) ? x.version : ''
    out.push({ id, name: NAMES[id], version: v, supported: SUPPORTED_FRAMEWORKS.has(id) })
  }
  return out
}

/** Bilesen denetcisi acisindan: kullanicinin goremeyecegi ama bilmesi gereken "algilandi ama adaptor yok" framework'leri */
export const unsupportedComponentFrameworks = (d: Detected[]): Detected[] => d.filter((x) => COMPONENT_FRAMEWORKS.has(x.id) && !x.supported)
