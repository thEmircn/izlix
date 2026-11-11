// Gercek YouTube (ag gerekir): reklam verisi kaynaginda siliniyor mu? Temel durum: engelleyici kapaliyken sayfada adPlacements olmali.
module.exports = async ({ tabs, sleep, settings, pageEval }) => {
  const out = {}
  const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ'
  const probe = () => pageEval(`(() => { const r = window.ytInitialPlayerResponse; return { has: !!r, ads: !!(r && (r.adPlacements || r.playerAds)), doc: !!window.__dbYtDoc } })()`).catch(() => null)
  settings.set({ adblock: 'off' })
  await tabs.create({ url, workspaceId: 'default' }); await sleep(9000)
  out.baseline = await probe()
  settings.set({ adblock: 'ads' })
  await tabs.create({ url, workspaceId: 'default' }); await sleep(9000)
  out.blocked = await probe()
  out.adShowing = await pageEval(`!!document.querySelector('.html5-video-player.ad-showing')`).catch(() => false)
  // ag yoksa / YouTube reklam sunmadiysa karsilastirma anlamsiz: basari = (temelde reklam varsa engelli halde yok)
  out.skipped = !out.baseline || !out.baseline.has || !out.baseline.ads
  out.ok = out.skipped ? true : (!!out.blocked && out.blocked.has && !out.blocked.ads && out.blocked.doc)
  return out
}
