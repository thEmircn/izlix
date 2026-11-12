module.exports = async ({ library, workspaces, shellEval, settings, notes }) => {
  const fs = require('fs'), path = require('path'), out = {}
  const dir = process.env.DB_ICLOUD_DIR; fs.mkdirSync(path.dirname(dir), { recursive: true })
  const api = (c) => shellEval(`window.izlix.${c}`)
  out.noPass = (await api('syncNow()')).error
  const ws = workspaces.list()[0]
  library.toggleBookmark(ws.id, 'https://gizli-yer-imi.example/a', 'A')
  await api(`syncSetup({ pass: 'cok-gizli-parola' })`)
  out.first = await api('syncNow()')
  const raw = fs.readFileSync(path.join(dir, 'sync.dbsync'), 'utf8')
  out.fileHasPlain = raw.includes('gizli-yer-imi')
  // baska cihaz: dosyaya uzaktan bir yer imi ekle (ayni parolayla)
  const cr = require('crypto')
  const decryptPayload = (t, pw) => { const e = JSON.parse(t); const d = cr.createDecipheriv('aes-256-gcm', cr.scryptSync(pw, Buffer.from(e.salt, 'base64'), 32), Buffer.from(e.iv, 'base64')); d.setAuthTag(Buffer.from(e.tag, 'base64')); return JSON.parse(Buffer.concat([d.update(Buffer.from(e.data, 'base64')), d.final()]).toString()) }
  const encryptPayload = (o, pw) => { const salt = cr.randomBytes(16), iv = cr.randomBytes(12), c = cr.createCipheriv('aes-256-gcm', cr.scryptSync(pw, salt, 32), iv); const data = Buffer.concat([c.update(JSON.stringify(o)), c.final()]); return JSON.stringify({ v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: c.getAuthTag().toString('base64'), data: data.toString('base64') }) }
  const p = decryptPayload(raw, 'cok-gizli-parola'); p.device = 'baska-mac'; p.ts += 10
  p.bookmarks[ws.name] = [...(p.bookmarks[ws.name] || []), { url: 'https://uzak.example/b', title: 'B', ts: Date.now() }]
  fs.writeFileSync(path.join(dir, 'sync.dbsync'), encryptPayload(p, 'cok-gizli-parola'))
  out.second = await api('syncNow()')
  out.bm = library.bookmarks(ws.id).length
  await api(`syncSetup({ pass: 'baska-parola-123' })`)
  out.wrong = (await api('syncNow()')).error
  // ozel klasor (Dropbox/OneDrive/Syncthing gibi): secilince esitleme oraya yazilir, sifirlaninca iCloud klasorune doner
  await api(`syncPickDir()`); await api(`syncSetup({ pass: 'cok-gizli-parola' })`)
  const st = await api('syncState()'); out.customDir = st.custom && st.dir === process.env.DB_SYNC_PICK
  fs.mkdirSync(path.dirname(process.env.DB_SYNC_PICK), { recursive: true })
  out.customSync = (await api('syncNow()')).ok; out.customFile = fs.existsSync(path.join(process.env.DB_SYNC_PICK, 'sync.dbsync'))
  await api('syncPickDir(true)'); out.reset = (await api('syncState()')).custom === false
  return out
}
