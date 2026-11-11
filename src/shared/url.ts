import { searchUrl } from './search'

/** Adres cubugu girdisini URL'ye cevirir: sema varsa aynen, localhost/IP/host:port -> http, .onion -> http, alan adi -> https, aksi secili motorda arama. */
export function resolveInput(raw: string, engine?: string): string {
  const input = raw.trim()
  if (!input) return 'about:blank'
  if (/^(about|file|devtools|view-source):/i.test(input)) return input
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input
  const hostLike = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?([/?#].*)?$/i
  if (hostLike.test(input) || /^[\w.-]+:\d+([/?#].*)?$/.test(input)) return `http://${input}`
  if (!/\s/.test(input) && /^[^\s/]+\.onion([:/?#].*)?$/i.test(input)) return `http://${input}` // onion siteleri cogunlukla http (Tor katmani sifreler)
  if (!/\s/.test(input) && /^[^\s/]+\.[a-z]{2,}([:/?#].*)?$/i.test(input)) return `https://${input}`
  return searchUrl(engine, input)
}

/** SAYFA kaynakli gezinme/pencere acma icin izinli adresler (kullanicinin adres cubuguna yazdiklari bundan etkilenmez). */
export const isAllowedPageNavigation = (url: string): boolean => /^(https?:\/\/|about:blank$)/i.test(url.trim())
