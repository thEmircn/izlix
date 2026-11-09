/** Adres cubugu girdisini URL'ye cevirir: sema varsa aynen, localhost/IP/host:port -> http, alan adi -> https, aksi arama. */
export function resolveInput(raw: string): string {
  const input = raw.trim()
  if (!input) return 'about:blank'
  if (/^(about|file|devtools|view-source):/i.test(input)) return input
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(input)) return input
  const hostLike = /^(localhost|\d{1,3}(\.\d{1,3}){3}|\[[0-9a-f:]+\])(:\d+)?([/?#].*)?$/i
  if (hostLike.test(input) || /^[\w.-]+:\d+([/?#].*)?$/.test(input)) return `http://${input}`
  if (!/\s/.test(input) && /^[^\s/]+\.[a-z]{2,}([:/?#].*)?$/i.test(input)) return `https://${input}`
  return `https://duckduckgo.com/?q=${encodeURIComponent(input)}`
}
