/** Zararli/kimlik avi site korumasi: (1) URLhaus zararli alan adi listesi (CC0), (2) taklit alan adi sezgisi. Google Safe Browsing DEGILDIR; daha dar kapsamlidir. */

/** URLhaus "hostfile" (127.0.0.1 alan.adi) veya duz alan adi listesi -> kume */
export function parseHostList(text: string): Set<string> {
  const out = new Set<string>()
  for (const raw of text.split('\n')) {
    const line = raw.replace(/#.*/, '').trim(); if (!line) continue
    const parts = line.split(/\s+/), host = (parts.length > 1 ? parts[1] : parts[0]).toLowerCase()
    if (/^[a-z0-9.-]+$/.test(host) && host.includes('.')) out.add(host)
  }
  return out
}

/** alan adi veya ust alan adlari listede mi */
export function listed(set: Set<string>, host: string): boolean {
  const labels = host.toLowerCase().split('.')
  for (let i = 0; i < labels.length - 1; i++) if (set.has(labels.slice(i).join('.'))) return true
  return false
}

const SECOND_LEVEL = new Set(['com', 'net', 'org', 'gov', 'edu', 'co', 'gen', 'web', 'av', 'k12'])
/** Kayitli alan adi (yaklasik): son iki etiket; com.tr/co.uk gibi ikinci seviyede uc */
export function registrable(host: string): string {
  const l = host.toLowerCase().split('.').filter(Boolean)
  if (l.length <= 2) return l.join('.')
  const take = l[l.length - 1].length === 2 && SECOND_LEVEL.has(l[l.length - 2]) ? 3 : 2
  return l.slice(-take).join('.')
}

const BRANDS: Record<string, string[]> = {
  google: ['google.com', 'google.com.tr', 'gstatic.com', 'googleapis.com', 'googleusercontent.com', 'goo.gl', 'google.co.uk', 'googlevideo.com', 'googlesyndication.com'],
  youtube: ['youtube.com', 'youtu.be', 'ytimg.com'], gmail: ['gmail.com'], facebook: ['facebook.com', 'fb.com', 'fbcdn.net'], instagram: ['instagram.com', 'cdninstagram.com'],
  whatsapp: ['whatsapp.com', 'whatsapp.net', 'wa.me'], telegram: ['telegram.org', 't.me', 'telegram.me'], paypal: ['paypal.com', 'paypal.me'], apple: ['apple.com', 'icloud.com', 'cdn-apple.com'],
  icloud: ['icloud.com'], microsoft: ['microsoft.com', 'live.com', 'office.com', 'microsoftonline.com', 'windows.net', 'msn.com', 'bing.com'], amazon: ['amazon.com', 'amazon.com.tr', 'amazonaws.com', 'amazon.co.uk'],
  netflix: ['netflix.com', 'nflxso.net'], github: ['github.com', 'githubusercontent.com', 'github.io'], linkedin: ['linkedin.com'], binance: ['binance.com'],
  garanti: ['garantibbva.com.tr', 'garanti.com.tr'], isbank: ['isbank.com.tr', 'isbank.com'], akbank: ['akbank.com'], ziraat: ['ziraatbank.com.tr'], yapikredi: ['yapikredi.com.tr'], papara: ['papara.com'], enpara: ['enpara.com'], trendyol: ['trendyol.com'], hepsiburada: ['hepsiburada.com'], turkcell: ['turkcell.com.tr']
}

function dist1(a: string, b: string): boolean {
  if (a === b || Math.abs(a.length - b.length) > 1) return false
  let i = 0; while (i < a.length && i < b.length && a[i] === b[i]) i++
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1) || (a[i] === b[i + 1] && a[i + 1] === b[i] && a.slice(i + 2) === b.slice(i + 2))
  const [s, l] = a.length < b.length ? [a, b] : [b, a]
  return s.slice(i) === l.slice(i + 1)
}

/** Taklit alan adi: resmi alan adi degil ama marka adini icerir/bir harf farkli. null: sorun yok */
export function lookalike(host: string): { brand: string } | null {
  const h = host.toLowerCase(), reg = registrable(h)
  for (const [brand, official] of Object.entries(BRANDS)) {
    if (official.some((o) => reg === o || h === o || h.endsWith('.' + o))) continue
    const label = reg.split('.')[0], tokens = label.split('-')
    if (brand.length >= 5 && (tokens.includes(brand) && tokens.length > 1)) return { brand } // paypal-giris.com
    if (brand.length >= 6 && label.length >= 6 && dist1(label, brand)) return { brand } // gooogle, paypa1
    if (h.split('.').slice(0, -2).some((l) => l === brand || l === `${brand}com`)) return { brand } // paypal.com.evil.io
  }
  return null
}

/** Karisik yazi sistemi (Latin + Kiril/Yunan): goruntu benzerligi saldirisi. Turkce harfler (c, g, i, o, s, u) Latin sayilir. */
export function mixedScript(unicodeHost: string): boolean {
  for (const label of unicodeHost.split('.')) if (/[a-z]/i.test(label) && /[Ͱ-ϿЀ-ӿ]/.test(label)) return true
  return false
}

export type ThreatKind = 'malware' | 'lookalike' | 'idn'
export function threatOf(url: string, set: Set<string>, unicodeHost?: string): { kind: ThreatKind; host: string; brand?: string } | null {
  let host = ''; try { const u = new URL(url); if (!/^https?:$/.test(u.protocol)) return null; host = u.hostname } catch { return null }
  if (!host.includes('.') || /^[\d.]+$/.test(host)) return null
  if (listed(set, host)) return { kind: 'malware', host }
  if (unicodeHost && mixedScript(unicodeHost)) return { kind: 'idn', host }
  const l = lookalike(host); if (l) return { kind: 'lookalike', host, brand: l.brand }
  return null
}
