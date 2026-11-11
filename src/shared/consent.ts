/** Cerez/KVKK bannerlari: bilinen cerceveleri gizler ve "reddet / yalniz gerekli" dugmesine kendiliginden basar (hicbir zaman "kabul et" basilmaz). */
export const CONSENT_CSS = `
#onetrust-banner-sdk, #onetrust-consent-sdk, #CybotCookiebotDialog, #CybotCookiebotDialogBodyUnderlay, #didomi-host, #didomi-popup, .didomi-popup-backdrop,
.qc-cmp2-container, #qc-cmp2-container, #cookie-law-info-bar, #cookie-notice, .cc-window, .cc-banner, #cmplz-cookiebanner-container, .cmplz-cookiebanner,
#truste-consent-track, .truste_overlay, #sp_message_container_, [id^="sp_message_container"], .evidon-banner, #usercentrics-root, #cookiescript_injected,
#gdpr-cookie-notice, .gdpr-cookie-notice, #cookie-banner, .cookie-banner, .cookie-consent, .cookie-notice, [id*="cookie-consent"], [class*="cookie-consent"] { display: none !important; }
html.db-consent-unlock, html.db-consent-unlock body { overflow: auto !important; position: static !important; }
`

export const CONSENT_SCRIPT = `(() => {
  if (window.__dbConsent) return
  window.__dbConsent = true
  const SEL = ['#onetrust-reject-all-handler', '.ot-pc-refuse-all-handler', '#CybotCookiebotDialogBodyButtonDecline', '#CybotCookiebotDialogBodyLevelButtonLevelOptinDeclineAll',
    '#didomi-notice-disagree-button', '.didomi-continue-without-agreeing', '#wt-cli-reject-btn', '.cmplz-deny', '[data-tid="banner-decline"]', '.qc-cmp2-summary-buttons button[mode="secondary"]',
    '.cc-deny', '#cookie_action_close_header_reject', 'button[data-cookiebanner="reject_button"]']
  const TXT = /^(reject all|reject|decline all|decline|deny|only necessary|necessary only|use necessary cookies only|continue without accepting|t[üu]m[üu]n[üu] reddet|reddet|kabul etme|sadece gerekli(?: [çc]erezler)?|yaln[ıi]zca gerekli(?: [çc]erezler)?|gerekli [çc]erezlerle devam et)$/i
  const BOX = /cookie|consent|gdpr|kvkk|[çc]erez|privacy|cmp/i
  const unlock = () => { document.documentElement.classList.add('db-consent-unlock') }
  const seen = new WeakSet()
  const press = (b) => { if (seen.has(b)) return false; seen.add(b); b.click(); return true }
  const tryOnce = () => {
    let done = false
    for (const s of SEL) { const b = document.querySelector(s); if (b && press(b)) done = true }
    for (const b of document.querySelectorAll('button, a[role="button"], [role="button"]')) {
      if (seen.has(b) || !TXT.test((b.textContent || '').trim())) continue
      let n = b, ok = false
      for (let i = 0; i < 6 && n; i++, n = n.parentElement) if (BOX.test((n.id || '') + ' ' + (typeof n.className === 'string' ? n.className : ''))) { ok = true; break }
      if (ok && press(b)) done = true
    }
    if (done) unlock()
  }
  let n = 0
  const h = setInterval(() => { tryOnce(); if (++n > 25) clearInterval(h) }, 600)
  tryOnce()
})()`
