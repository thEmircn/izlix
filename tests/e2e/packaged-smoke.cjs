// Paketlenmis uygulama duman testi: uygulama acildi mi, paketli mi, shell yuklendi mi
module.exports = async ({ app, sleep, shellEval }) => {
  await sleep(1500)
  return { packaged: app.isPackaged, version: app.getVersion(), shell: await shellEval(`!!document.querySelector('.tabstrip, .vside')`) }
}
