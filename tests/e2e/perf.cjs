// Teknik hedefler: soguk acilis < 1.5 s, bellek (kabuk + 1 sekme) < 350 MB, 10 sekme < 1.5 GB
module.exports = async ({ app, tabs, sleep }) => {
  const cp = require('child_process')
  const fp = () => { // macOS phys_footprint: paylasilan sayfalari tekrar saymaz
    const pids = app.getAppMetrics().map((m) => String(m.pid))
    const o = cp.spawnSync('footprint', pids).stdout.toString()
    const m = o.match(/Footprint:\s+([\d.]+)\s+(MB|GB|KB)/g) || []
    return m.length ? o.split('\n').filter((l) => /^\s*Footprint:|^\s*Footprint total|TOTAL/i.test(l)).slice(-3) : o.slice(-300)
  }
  const mb = () => Math.round(app.getAppMetrics().reduce((a, m) => a + m.memory.workingSetSize, 0) / 1024)
  const out = { startupSecAtScript: +process.uptime().toFixed(2) }
  await sleep(2500)
  const first = await tabs.create({ url: 'localhost:5173', workspaceId: 'default' }); await sleep(3000)
  out.mem1TabMB = mb(); out.fp1 = fp()
  for (let i = 0; i < 9; i++) await tabs.create({ url: 'localhost:5173', workspaceId: 'default' })
  await sleep(6000)
  out.mem10TabsMB = mb(); out.fp10 = fp()
  out.processes = app.getAppMetrics().length
  return out
}
