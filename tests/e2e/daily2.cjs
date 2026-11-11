module.exports = async ({ tabs, sleep, shellEval: se, pageEval }) => {
  const http = require('http'), fs = require('fs'), os = require('os'), path = require('path'), out = {}
  const shellEval = (c) => se(c).catch((e) => 'ERR ' + e)
  const para = (n) => `<p>Bu ${n}. paragraf, okuyucu modunun ana yazıyı bulabilmesi için yeterince uzun bir metin içerir ve gerçek bir makale gibi davranır, böylece puanlama çalışır.</p>`
  const article = `<title>Makale</title><body><nav id="menu">MENU-LINKLERI</nav><div class="sidebar-ad">REKAM-KUTUSU</div><article><h1>Gercek Baslik</h1>${[1, 2, 3, 4, 5].map(para).join('')}</article><footer>ALT-BILGI</footer></body>`
  const srv = http.createServer((q, r) => { r.writeHead(200, { 'content-type': 'text/html' }); r.end(q.url === '/tiny' ? '<p>kisa</p>' : q.url === '/article' ? article : `<title>sayfa ${q.url}</title><p>x</p>`) })
  await new Promise((r) => srv.listen(5271, '127.0.0.1', r))

  // ---- sekme uyutma ----
  const a = await tabs.create({ url: 'http://localhost:5271/a', workspaceId: 'default' }); await sleep(1800)
  const b = await tabs.create({ url: 'http://localhost:5271/b', workspaceId: 'default' }); await sleep(1800)
  out.sleepActive = await shellEval(`window.izlix.sleepTab('${b}')`) // aktif sekme uyutulmaz
  out.sleepOne = await shellEval(`window.izlix.sleepTab('${a}')`)
  await sleep(500)
  const ia = () => tabs.list().tabs.find((t) => t.id === a)
  out.sleeping = ia().sleeping === true
  out.keepsUrl = ia().url.includes('/a')
  out.sleepClass = await shellEval(`document.querySelectorAll('.tab.sleeping').length`)
  out.cdpDetached = !tabs.get(a).cdp
  tabs.activate(a); await sleep(3000)
  out.woke = !ia().sleeping
  out.reloaded = await pageEval(`document.title`)
  out.cdpBack = !!tabs.get(a).cdp
  tabs.activate(b); await sleep(500)
  out.sleepOthers = await shellEval(`window.izlix.sleepTab(null)`) // aktif disindaki uygun tum sekmeler
  tabs.activate(a); await sleep(2500)

  // ---- okuyucu modu ----
  const r = await tabs.create({ url: 'http://localhost:5271/article', workspaceId: 'default' }); await sleep(2000)
  out.readerOk = await shellEval(`window.izlix.reader()`)
  out.readerTitle = await pageEval(`document.querySelector('.db-reader h1')?.textContent`)
  out.readerNoNav = await pageEval(`!document.body.textContent.includes('MENU-LINKLERI') && !document.body.textContent.includes('REKAM-KUTUSU') && !document.body.textContent.includes('ALT-BILGI')`)
  out.readerHasText = await pageEval(`document.querySelectorAll('.db-reader p').length`)
  out.readerExit = await shellEval(`window.izlix.reader()`); await sleep(1500)
  out.readerRestored = await pageEval(`!!document.getElementById('menu') && !document.querySelector('.db-reader')`)
  const t = await tabs.create({ url: 'http://localhost:5271/tiny', workspaceId: 'default' }); await sleep(1500)
  out.readerNone = await shellEval(`window.izlix.reader()`)

  // ---- Chrome / Safari ice aktarma (fixture) ----
  const { DatabaseSync } = require('node:sqlite')
  const cdir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-chr-'))
  fs.writeFileSync(path.join(cdir, 'Bookmarks'), JSON.stringify({ roots: { bookmark_bar: { children: [{ type: 'url', url: 'https://imp-chrome.test/', name: 'ChromeBM' }] } } }))
  let db = new DatabaseSync(path.join(cdir, 'History')); db.exec('CREATE TABLE urls (id INTEGER PRIMARY KEY, url TEXT, title TEXT, last_visit_time INTEGER)'); db.prepare('INSERT INTO urls (url,title,last_visit_time) VALUES (?,?,?)').run('https://imp-chrome.test/h', 'CH', 13_300_000_000_000_000); db.close()
  process.env.DB_CHROME_DIR = cdir
  out.chromeImport = await shellEval(`window.izlix.importChrome()`)
  const sdir = fs.mkdtempSync(path.join(os.tmpdir(), 'e2e-saf-'))
  fs.writeFileSync(path.join(sdir, 'Bookmarks.plist'), `<?xml version="1.0" encoding="UTF-8"?><!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd"><plist version="1.0"><dict><key>Children</key><array><dict><key>URIDictionary</key><dict><key>title</key><string>SafariBM</string></dict><key>URLString</key><string>https://imp-safari.test/</string><key>WebBookmarkType</key><string>WebBookmarkTypeLeaf</string></dict></array></dict></plist>`)
  db = new DatabaseSync(path.join(sdir, 'History.db')); db.exec('CREATE TABLE history_items (id INTEGER PRIMARY KEY, url TEXT); CREATE TABLE history_visits (id INTEGER PRIMARY KEY, history_item INTEGER, visit_time REAL, title TEXT)')
  db.prepare('INSERT INTO history_items VALUES (1, ?)').run('https://imp-safari.test/h'); db.prepare('INSERT INTO history_visits (history_item, visit_time, title) VALUES (1, 700000000, ?)').run('SF'); db.close()
  process.env.DB_SAFARI_DIR = sdir
  out.safariImport = await shellEval(`window.izlix.importSafari()`)
  out.importAgain = await shellEval(`window.izlix.importChrome()`)
  // varsayilan tarayici: yalnizca durum sorgusu (sistemi degistirmez)
  out.defaultStatusType = await shellEval(`window.izlix.defaultBrowser(false).then(v => typeof v)`)
  srv.close(); return out
}
