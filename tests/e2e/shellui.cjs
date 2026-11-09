module.exports = async ({ win, sleep, shellEval, shot }) => {
  const logs = []
  win.webContents.on('console-message', (_e, level, message) => logs.push(`${level}: ${message}`.slice(0, 300)))
  win.webContents.reload(); await sleep(2500)
  const html = await shellEval('document.getElementById("root").innerHTML.length')
  await shot('/private/tmp/e2e-tmp/shell2.png')
  return { html, logs }
}
