import { app, dialog, shell, type BrowserWindow } from 'electron'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { release } from 'node:os'
import type { TabManager } from './tabs'
import type { EventBus } from './bus'
import { makeZip } from './zip'
import { buildHar, buildSummary, consoleDump, toNdjson } from './report-data'
import { maskDeep } from '../shared/mask'

/** Bug Report Generator v0 (#10): tek tikla zip. Dosya yalnizca kullanici kaydedince diske yazilir. */
export async function exportReport(win: BrowserWindow, tabs: TabManager, bus: EventBus, workspaceName: (id: string) => string, savePath?: string): Promise<string | null> {
  const tab = tabs.active()
  if (!tab) return null
  const events = bus.snapshot(tab.info.id)
  const wc = tab.view.webContents
  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  let target = savePath
  if (!target) {
    const r = await dialog.showSaveDialog(win, { defaultPath: join(app.getPath('downloads'), `izlix-report-${stamp}.zip`), filters: [{ name: 'Zip', extensions: ['zip'] }] })
    if (r.canceled || !r.filePath) return null
    target = r.filePath
  }
  const env = {
    url: wc.getURL(), title: wc.getTitle(), workspace: workspaceName(tab.info.workspaceId), app: `izlix ${app.getVersion()}`,
    electron: process.versions.electron, chrome: process.versions.chrome, os: `macOS (darwin ${release()})`, arch: process.arch, generatedAt: new Date().toISOString()
  }
  const png = (await wc.capturePage()).toPNG()
  const files = [
    { name: 'summary.md', data: Buffer.from(buildSummary(events, env)) },
    { name: 'timeline.ndjson', data: Buffer.from(toNdjson(events)) },
    { name: 'network.har', data: Buffer.from(JSON.stringify(buildHar(events, app.getVersion()), null, 1)) },
    { name: 'console.json', data: Buffer.from(JSON.stringify(consoleDump(events), null, 1)) },
    { name: 'environment.json', data: Buffer.from(JSON.stringify(maskDeep(env), null, 1)) },
    { name: 'screenshot.png', data: png }
  ]
  writeFileSync(target, makeZip(files))
  if (!savePath) shell.showItemInFolder(target)
  return target
}
