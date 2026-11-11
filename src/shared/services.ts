/** Gunluk uygulamalar (Hub): her biri kendi izole, kalici oturumunda (giris korunur) web surumuyle acilir. */
export interface Service { id: string; name: string; url: string; color: string; /** kullanicinin kendi adresi gerekir (YouTrack) */ custom?: boolean; /** okunmamis sayisi baslikta gelir */ unread: boolean; hosts: string[] }

export const SERVICES: Service[] = [
  { id: 'whatsapp', name: 'WhatsApp', url: 'https://web.whatsapp.com/', color: '#25d366', unread: true, hosts: ['web.whatsapp.com'] },
  { id: 'telegram', name: 'Telegram', url: 'https://web.telegram.org/a/', color: '#2aabee', unread: true, hosts: ['web.telegram.org'] },
  { id: 'meet', name: 'Meet', url: 'https://meet.google.com/', color: '#00a37a', unread: false, hosts: ['meet.google.com'] },
  { id: 'youtrack', name: 'YouTrack', url: '', color: '#b45cff', custom: true, unread: true, hosts: [] },
  { id: 'youtube', name: 'YouTube', url: 'https://www.youtube.com/', color: '#ff2d2d', unread: true, hosts: ['www.youtube.com', 'youtube.com', 'm.youtube.com'] },
  { id: 'instagram', name: 'Instagram', url: 'https://www.instagram.com/', color: '#f5a742', unread: true, hosts: ['www.instagram.com', 'instagram.com'] }
]

export const servicePartition = (id: string): string => `persist:svc-${id}`
export const serviceById = (id: string): Service | undefined => SERVICES.find((s) => s.id === id)

/** Sayfa basligindan okunmamis sayisi: "(3) WhatsApp", "(12) YouTube", "3 unread messages"; yoksa 0 */
export function parseUnread(title: string): number {
  const m = /^\s*\((\d{1,4})\+?\)/.exec(title) ?? /^\s*(\d{1,4})\+?\s+(?:unread|new|okunmam)/i.exec(title)
  return m ? Number(m[1]) : 0
}

export interface HubSettings { /** etkin servis kimlikleri */ enabled: string[]; /** ozel adresler (YouTrack) */ urls: Record<string, string>; /** uygulamayla birlikte arka planda baslat */ autostart: boolean }
export const DEFAULT_HUB: HubSettings = { enabled: ['whatsapp', 'telegram', 'meet', 'youtube', 'instagram'], urls: {}, autostart: false }

/** Servisin acilacak adresi (ozel adres https'e tamamlanir); yoksa null */
export function serviceUrl(s: Service, hub: HubSettings): string | null {
  const raw = s.custom ? (hub.urls[s.id] ?? '').trim() : s.url
  if (!raw) return null
  const u = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`
  try { return new URL(u).toString() } catch { return null }
}

/** Adres hangi servise ait (ozel adresler dahil) */
export function serviceForUrl(url: string, hub: HubSettings): Service | undefined {
  let host = ''; try { host = new URL(url).hostname } catch { return undefined }
  for (const s of SERVICES) {
    if (s.hosts.includes(host)) return s
    if (s.custom) { const su = serviceUrl(s, hub); if (su) { try { if (new URL(su).hostname === host) return s } catch { /* yok say */ } } }
  }
  return undefined
}

/** Etkin servislerden okunmamis toplamina gore bir sonraki sekme: once en cok okunmamislar */
export function nextUnread(items: { id: string; unread: number }[], currentId?: string): string | null {
  const l = items.filter((x) => x.unread > 0).sort((a, b) => b.unread - a.unread)
  if (!l.length) return null
  const i = l.findIndex((x) => x.id === currentId)
  return l[(i + 1) % l.length].id
}
