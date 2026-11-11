// Adres izleme parametrelerini temizleme (saf). Yalnizca bilinen reklam/analitik parametreleri; sitenin isleyisi icin gerekli olabilecek (ref, id, q...) dokunulmaz.
const EXACT = new Set(['fbclid', 'gclid', 'gclsrc', 'dclid', 'gbraid', 'wbraid', 'msclkid', 'yclid', 'twclid', 'ttclid', 'li_fat_id', 'igshid', 'igsh',
  'mc_eid', 'mc_cid', '_hsenc', '_hsmi', '__hssc', '__hstc', '__hsfp', 'mkt_tok', 'oly_enc_id', 'oly_anon_id', 'vero_id', 'vero_conv', 's_cid', 'spm_id_from', '_ga', '_gl', 'cmpid', 'wickedid', 'rb_clickid', 'irclickid'])
const PREFIX = ['utm_', 'mtm_', 'pk_', 'hsa_']
const isLoop = (h: string): boolean => h === 'localhost' || h === '127.0.0.1' || h === '[::1]' || h.endsWith('.localhost')

/** Izleme parametrelerini siler; degisiklik yoksa girdiyi aynen doner. `allowLoopback`: yerel (dev) adreslerde de temizle. */
export function cleanTrackingParams(url: string, allowLoopback = false): string {
  let u: URL
  try { u = new URL(url) } catch { return url }
  if ((u.protocol !== 'http:' && u.protocol !== 'https:') || !u.search) return url
  if (isLoop(u.hostname) && !allowLoopback) return url
  const youtube = /(^|\.)(youtu\.be|youtube\.com)$/.test(u.hostname)
  let changed = false
  for (const k of [...u.searchParams.keys()]) {
    const lk = k.toLowerCase()
    if (EXACT.has(lk) || PREFIX.some((p) => lk.startsWith(p)) || (youtube && lk === 'si')) { u.searchParams.delete(k); changed = true }
  }
  return changed ? u.toString() : url
}
