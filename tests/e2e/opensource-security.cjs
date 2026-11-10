// Click-to-source yalnizca guvenilir kok altindaki dosyalari acar (kotu niyetli sayfa /etc/passwd'yi "bilinen" yapamaz)
module.exports = async ({ tabs, sleep, shellEval }) => {
  const out = {}
  const id = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3500)
  const r = tabs.get(id).cdp.resolver
  const root = r.rootProvider()
  out.root = root
  r.knownFiles.add('/etc/passwd'); r.knownFiles.add('/etc/hosts'); r.knownFiles.add(root + '/src/App.tsx'); r.knownFiles.add(root + '/../secret.txt')
  const open = (file) => shellEval(`window.izlix.openSource({ file: ${JSON.stringify(file)}, line: 1 })`)
  out.insideRoot = await open(root + '/src/App.tsx')
  out.etcPasswd = await open('/etc/passwd')
  out.traversal = await open(root + '/../secret.txt')
  out.unknown = await open(root + '/src/NotSeen.tsx')
  out.preciseOutside = r.setPrecise(901, 'Evil', '/etc/passwd:1:1')
  out.preciseInside = !!r.setPrecise(902, 'Good', root + '/src/App.tsx:3:1')
  out.knownHasPasswdFromPrecise = r.knownFiles.has('/etc/passwd') // elle eklediysek true; precise yolu eklememeli
  return out
}
