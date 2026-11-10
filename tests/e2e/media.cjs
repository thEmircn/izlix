// Tema ve hareket emulasyonu (tek gorunum ve Lab)
module.exports = async ({ tabs, sleep, pageEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(2500)
  const q = "[matchMedia('(prefers-color-scheme: dark)').matches, matchMedia('(prefers-reduced-motion: reduce)').matches]"
  out.before = await pageEval(q)
  await tabs.setMedia(id, 'dark', true); out.dark = await pageEval(q)
  await tabs.setMedia(id, 'light', false); out.light = await pageEval(q)
  await tabs.setMedia(id, 'light', true)
  await tabs.setLab(id, ['laptop', 'iphone-se']); await sleep(3000)
  const lab = tabs.get(id).lab
  out.labViews = await Promise.all(lab.views.map((v) => v.wc.executeJavaScript(q)))
  await tabs.setMedia(id, null, false); await sleep(300)
  out.labReset = await Promise.all(lab.views.map((v) => v.wc.executeJavaScript(q)))
  out.resetOk = out.labReset.every((r) => r[0] === out.before[0] && r[1] === out.before[1])
  out.info = tabs.get(id).info.media ?? null
  return out
}
