// Yerel ag (LAN) adresi: localhost dev sunucusunu telefondan acmak icin (saf).
export interface Iface { family: string | number; internal: boolean; address: string }
const isPrivate = (ip: string): boolean => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(ip)

/** Ozel (RFC1918) IPv4 adresi; once 192.168.x (ev/ofis wifi), sonra 10.x, sonra 172.16-31. Yoksa null. */
export function pickLanIp(ifaces: Record<string, Iface[] | undefined>): string | null {
  const all: string[] = []
  for (const list of Object.values(ifaces)) for (const i of list ?? []) if ((i.family === 'IPv4' || i.family === 4) && !i.internal && isPrivate(i.address)) all.push(i.address)
  return all.find((a) => a.startsWith('192.168.')) ?? all.find((a) => a.startsWith('10.')) ?? all[0] ?? null
}
/** localhost/127.0.0.1/::1 adresini LAN IP'siyle degistirir (port ve yol korunur); loopback degilse null */
export function lanUrl(url: string, ip: string): string | null {
  try {
    const u = new URL(url)
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
    if (!(u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]' || u.hostname.endsWith('.localhost'))) return null
    u.hostname = ip; return u.toString()
  } catch { return null }
}
