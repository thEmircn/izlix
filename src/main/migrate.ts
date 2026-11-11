import { existsSync, renameSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Uygulama Izlix -> Izlix olarak yeniden adlandirildiginda eski kullanici verisi (oturumlar, sifreler, yer imleri, ayarlar)
 * kaybolmasin: eski klasor yeni ada tasinir ve veritabani dosyasi yeniden adlandirilir. Yeni klasor zaten varsa hicbir sey yapilmaz.
 */
export function migrateLegacyData(appData: string, legacyName = 'izlix', newName = 'izlix'): 'moved' | 'none' {
  const oldDir = join(appData, legacyName), newDir = join(appData, newName)
  if (!existsSync(oldDir) || existsSync(newDir)) return 'none'
  renameSync(oldDir, newDir)
  for (const suffix of ['', '-wal', '-shm']) {
    const from = join(newDir, `izlix.db${suffix}`), to = join(newDir, `izlix.db${suffix}`)
    if (existsSync(from) && !existsSync(to)) renameSync(from, to)
  }
  return 'moved'
}
