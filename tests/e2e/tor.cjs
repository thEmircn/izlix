module.exports = async ({ tabs, sleep }) => {
  const net = require('net'), out = { socksHits: 0, firstByte: null }
  // sahte SOCKS5 sunucusu: Tor sekmesi trafigi buraya gonderiyor mu?
  const srv = net.createServer((s) => { out.socksHits++; s.once('data', (d) => { if (out.firstByte === null) out.firstByte = d[0]; s.destroy() }); s.on('error', () => {}) })
  await new Promise((r) => srv.listen(9150, '127.0.0.1', r))
  const id = await tabs.create({ url: 'http://abcdefghijklmnop.onion/', workspaceId: 'default', private: 'tor' }); await sleep(2500)
  const info = tabs.list().tabs.find((t) => t.id === id)
  out.isTor = info?.private === 'tor'
  tabs.close(id); srv.close(); return out
}
