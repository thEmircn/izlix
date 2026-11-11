// Arama motorlari: adres cubugunda alan adi olmayan girdi secili motorda aranir. Saf veri.
export interface Engine { id: string; label: string; url: string; host: string }
export const ENGINES: Engine[] = [
  { id: 'duckduckgo', label: 'DuckDuckGo', url: 'https://duckduckgo.com/?q=%s', host: 'duckduckgo.com' },
  { id: 'google', label: 'Google', url: 'https://www.google.com/search?q=%s', host: 'google.com' },
  { id: 'yandex', label: 'Yandex', url: 'https://yandex.com.tr/search/?text=%s', host: 'yandex.com.tr' },
  { id: 'bing', label: 'Bing', url: 'https://www.bing.com/search?q=%s', host: 'bing.com' },
  { id: 'brave', label: 'Brave Search', url: 'https://search.brave.com/search?q=%s', host: 'search.brave.com' }
]
export const DEFAULT_ENGINE = 'duckduckgo'
export const engineById = (id: string | undefined): Engine => ENGINES.find((e) => e.id === id) ?? ENGINES[0]
export const searchUrl = (id: string | undefined, q: string): string => engineById(id).url.replace('%s', encodeURIComponent(q))
