import { net } from 'electron'
import { isOlder } from '../shared/version'

export interface UpdateInfo { electron: string; chromium: string; latest: string; newer: boolean; checked: number; error: boolean }
let info: UpdateInfo = { electron: process.versions.electron, chromium: process.versions.chrome, latest: '', newer: false, checked: 0, error: false }
export const updateInfo = (): UpdateInfo => info

/** Guvenlik yamasi denetimi: npm kaydindan yalniz "en son Electron surumu" okunur (kullanici verisi gitmez). Otomatik kurulum YOK: imzasiz/kaynaktan calisir. */
export async function checkUpdate(): Promise<UpdateInfo> {
  try {
    const r = await net.fetch('https://registry.npmjs.org/electron/latest', { headers: { accept: 'application/json' } })
    if (!r.ok) throw new Error(String(r.status))
    const j = (await r.json()) as { version?: string }; const latest = String(j.version ?? '')
    info = { ...info, latest, newer: isOlder(process.versions.electron, latest), checked: Date.now(), error: !latest }
  } catch { info = { ...info, checked: Date.now(), error: true } }
  return info
}
