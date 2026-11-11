// Reklam/izleyici engelleme karari (saf). Kendi derledigimiz, bilinen reklam ve izleme alan adlarindan olusan kucuk liste;
// ucuncu taraf filtre listelerinin lisansina bagli degildir (plan bolum 11). Kural: yalnizca ucuncu taraf istekleri; ana belge asla engellenmez.
export type BlockLevel = 'off' | 'ads' | 'strict'

const list = (s: string): Set<string> => new Set(s.split(/\s+/).filter(Boolean))

/** Reklam aglari / reklam sunuculari (ads ve strict) */
export const AD_DOMAINS = list(`
doubleclick.net googlesyndication.com googleadservices.com adservice.google.com pagead2.googlesyndication.com tpc.googlesyndication.com
2mdn.net adnxs.com adsrvr.org rubiconproject.com pubmatic.com openx.net casalemedia.com indexww.com criteo.com criteo.net
taboola.com outbrain.com revcontent.com mgid.com zemanta.com amazon-adsystem.com media.net adform.net smartadserver.com
advertising.com adtech.com adtechus.com contextweb.com sharethrough.com triplelift.com 33across.com bidswitch.net
yieldmo.com teads.tv spotxchange.com springserve.com lijit.com sovrn.com gumgum.com undertone.com inmobi.com
moatads.com adsafeprotected.com doubleverify.com serving-sys.com sizmek.com flashtalking.com adroll.com
connatix.com primis.tech vidazoo.com ad.gt adzerk.net carbonads.net buysellads.com exoclick.com juicyads.com
trafficjunky.net popads.net propellerads.com popcash.net adsterra.com clickadu.com hilltopads.net
yandexadexchange.net an.yandex.ru awaps.yandex.net adfox.ru adhigh.net admixer.net
adform.com ads.yahoo.com ads.twitter.com ads.linkedin.com ads.pinterest.com ads.tiktok.com analytics.tiktok.com
admatic.com.tr adcolony.com unityads.unity3d.com applovin.com ironsrc.com vungle.com
`)

/** Izleyiciler / analitik (yalniz strict) */
export const TRACKER_DOMAINS = list(`
google-analytics.com googletagmanager.com googletagservices.com analytics.google.com stats.g.doubleclick.net
connect.facebook.net facebook.net pixel.facebook.com scorecardresearch.com quantserve.com quantcast.com
hotjar.com hotjar.io mouseflow.com fullstory.com crazyegg.com luckyorange.com clarity.ms
segment.com segment.io cdn.segment.com mixpanel.com amplitude.com heapanalytics.com
bat.bing.com omtrdc.net demdex.net everesttech.net krxd.net bluekai.com
branch.io adjust.com appsflyer.com kochava.com singular.net
chartbeat.com chartbeat.net parsely.com newrelic.com nr-data.net
optimizely.com vwo.com abtasty.com
snap.licdn.com px.ads.linkedin.com ct.pinterest.com t.co analytics.twitter.com
mc.yandex.ru mc.yandex.com
`)

const PATH_AD = /(\/pagead\/|\/adserver\/|\/adframe|\/ad_frame|\/adview\/|\/ads\/ads\.|\/banner_ads\/|[?&]ad_type=|\/gampad\/ads)/i
// YouTube'un kendi alan adinda reklam/izleme uc noktalari
const YT_AD = /^\/(pagead\/|api\/stats\/ads|ptracking|youtubei\/v1\/player\/ad_break|get_midroll_)/i

const hostOf = (u: string): string | null => { try { return new URL(u).hostname.toLowerCase() } catch { return null } }
export const isLoopbackHost = (h: string): boolean => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h === '::1' || h === '0.0.0.0' || h.endsWith('.localhost')

/** host veya ust alan adlarindan biri kumede mi (a.b.c.com -> b.c.com -> c.com) */
export function inSet(host: string, set: Set<string>): boolean {
  let h = host
  while (h) { if (set.has(h)) return true; const i = h.indexOf('.'); if (i < 0) return false; h = h.slice(i + 1) }
  return false
}
/** "site" karsilastirmasi: son iki etiket (basit; ikinci duzey .com.tr gibi ekler icin son uc) */
export function siteOf(host: string): string {
  const p = host.split('.'); if (p.length <= 2) return host
  return /^(com|co|org|net|gov|edu)$/.test(p[p.length - 2]) && p[p.length - 1].length === 2 ? p.slice(-3).join('.') : p.slice(-2).join('.')
}

export interface BlockOpts { level: BlockLevel; allow: Iterable<string>; blockOnDev?: boolean }
export type BlockReason = 'ad' | 'tracker' | 'youtube'

/** Istegin engellenip engellenmeyecegi; null = gecir. `resourceType` Electron'un (mainFrame, subFrame, script, image, xhr, ...) degeri. */
export function decide(url: string, resourceType: string, pageUrl: string | undefined, o: BlockOpts): BlockReason | null {
  if (o.level === 'off' || resourceType === 'mainFrame') return null
  const host = hostOf(url); if (!host) return null
  const pageHost = pageUrl ? hostOf(pageUrl) : null
  if (pageHost) {
    if (isLoopbackHost(pageHost) && !o.blockOnDev) return null // gelistirme sayfalarina dokunma (sayfayi bozma ilkesi)
    const allow = new Set(o.allow); if (inSet(pageHost, allow)) return null // site bazli izin
  }
  if (isLoopbackHost(host)) return null
  const first = pageHost !== null && siteOf(host) === siteOf(pageHost)
  if (/^(www\.|m\.|music\.)?youtube\.com$/.test(host) && YT_AD.test(safePath(url))) return 'youtube'
  if (first) return null
  if (inSet(host, AD_DOMAINS)) return 'ad'
  if (o.level === 'strict' && inSet(host, TRACKER_DOMAINS)) return 'tracker'
  if (PATH_AD.test(safePath(url) + safeSearch(url)) && (resourceType === 'script' || resourceType === 'image' || resourceType === 'subFrame' || resourceType === 'xhr')) return 'ad'
  return null
}
const safePath = (u: string): string => { try { return new URL(u).pathname } catch { return '' } }
const safeSearch = (u: string): string => { try { return new URL(u).search } catch { return '' } }

/** CDP Fetch kalip listesi: yalnizca bilinen reklam/izleyici alan adlari ve yol kaliplari duraklatilir (diger istekler hic kesilmez). */
export function adPatterns(level: BlockLevel): { urlPattern: string; requestStage: 'Request' }[] {
  if (level === 'off') return []
  const hosts = level === 'strict' ? [...AD_DOMAINS, ...TRACKER_DOMAINS] : [...AD_DOMAINS]
  const pats = new Set<string>()
  for (const h of hosts) { pats.add(`*://${h}/*`); pats.add(`*://*.${h}/*`) }
  for (const p of ['*://*/pagead/*', '*://*/adserver/*', '*://*/gampad/ads*', '*://*.youtube.com/api/stats/ads*', '*://*.youtube.com/ptracking*', '*://*.youtube.com/youtubei/v1/player/ad_break*', '*://*.youtube.com/get_midroll_*']) pats.add(p)
  return [...pats].map((urlPattern) => ({ urlPattern, requestStage: 'Request' as const }))
}
/** CDP kaynak turu -> decide() turu */
export const cdpType = (t: string | undefined, isMainNav: boolean): string =>
  t === 'Document' ? (isMainNav ? 'mainFrame' : 'subFrame') : t === 'Script' ? 'script' : t === 'Image' ? 'image' : t === 'XHR' || t === 'Fetch' ? 'xhr' : t === 'Stylesheet' ? 'stylesheet' : 'other'

/** Sayfaya eklenen genel "gorunumu gizle" CSS (reklam kutulari); yalnizca engelleme aciksa */
export const COSMETIC_CSS = `
ins.adsbygoogle, .adsbygoogle, [id^="google_ads_iframe"], [id^="div-gpt-ad"], iframe[src*="doubleclick.net"], iframe[src*="googlesyndication.com"],
.ad-banner, .ad-container, .ad-slot, .ad-wrapper, .advert, .advertisement, [aria-label="Advertisement"], [data-ad-slot], [data-google-query-id]:not(body),
#masthead-ad, ytd-ad-slot-renderer, ytd-in-feed-ad-layout-renderer, ytd-banner-promo-renderer, ytd-promoted-sparkles-web-renderer, ytd-display-ad-renderer,
ytd-player-legacy-desktop-watch-ads-renderer, .ytp-ad-overlay-container, .ytp-ad-image-overlay, #player-ads, ytd-merch-shelf-renderer
{ display: none !important; }
`

/** YouTube: reklam VERISINI kaynaginda sil. Belge baslangicinda (sayfa betiklerinden once) enjekte edilir: ilk yukleme JSON'u (ytInitialPlayerResponse)
 *  ve sonraki player/next yanitlarindaki adPlacements/playerAds/adSlots alanlari atilir; oynatici hic reklam planlamaz. */
export const YOUTUBE_DOC_SCRIPT = `(() => {
  if (!/(^|\\.)youtube\\.com$/.test(location.hostname) || window.__dbYtDoc) return
  window.__dbYtDoc = true
  const KEYS = ['adPlacements', 'playerAds', 'adSlots', 'adBreakHeartbeatParams']
  const strip = (o, d) => {
    if (!o || typeof o !== 'object' || (d || 0) > 6) return o
    if (Array.isArray(o)) { for (const x of o) strip(x, (d || 0) + 1); return o }
    for (const k of KEYS) if (k in o) { try { delete o[k] } catch (e) {} }
    for (const k in o) { const v = o[k]; if (v && typeof v === 'object') strip(v, (d || 0) + 1) }
    return o
  }
  let ipr
  try { Object.defineProperty(window, 'ytInitialPlayerResponse', { configurable: true, get() { return ipr }, set(v) { ipr = strip(v, 0) } }) } catch (e) {}
  const oj = Response.prototype.json
  Response.prototype.json = function () { const u = this.url; return oj.call(this).then((j) => (/\\/youtubei\\/v1\\/(player|next|get_watch)/.test(u) ? strip(j, 0) : j)) }
  const op = JSON.parse
  JSON.parse = function (t, r) { const v = op.call(this, t, r); return typeof t === 'string' && t.length > 1000 && (t.indexOf('"adPlacements"') >= 0 || t.indexOf('"playerAds"') >= 0) ? strip(v, 0) : v }
})()`

/** YouTube: reklam gorununce atla / hizlandir. Sayfa dunyasinda calisir; yalnizca youtube.com'da enjekte edilir. */
export const YOUTUBE_SCRIPT = `(() => {
  if (window.__dbYtAd) return; window.__dbYtAd = true
  const tick = () => {
    const p = document.querySelector('.html5-video-player'); if (!p) return
    const v = p.querySelector('video')
    const ad = p.classList.contains('ad-showing') || p.classList.contains('ad-interrupting')
    const skip = p.querySelector('.ytp-skip-ad-button, .ytp-ad-skip-button, .ytp-ad-skip-button-modern, .ytp-ad-skip-button-container button')
    if (skip) skip.click()
    if (ad && v && isFinite(v.duration) && v.duration > 0) { try { v.muted = true; v.playbackRate = 16; v.currentTime = Math.max(0, v.duration - 0.1) } catch (e) {} }
    else if (v && v.playbackRate === 16) { v.playbackRate = 1; v.muted = false }
    const close = document.querySelector('.ytp-ad-overlay-close-button'); if (close) close.click()
  }
  setInterval(tick, 400)
})()`
