import { useId } from 'react'

/** Izlix isareti: koyu yuvarlak kare, dort noktali iz cizgisi ve amber son nokta (build/icon.svg ile ayni cizim). */
export function Logo({ size = 22, title }: { size?: number; title?: string }) {
  const gid = useId()
  return (
    <svg width={size} height={size} viewBox="64 64 896 896" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} style={{ flex: 'none', display: 'block' }}>
      <defs><linearGradient id={gid} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#2a2a2e" /><stop offset="1" stopColor="#0c0c0d" /></linearGradient></defs>
      <rect x="64" y="64" width="896" height="896" rx="208" fill={`url(#${gid})`} />
      <rect x="64.5" y="64.5" width="895" height="895" rx="207.5" fill="none" stroke="#fff" strokeOpacity=".16" strokeWidth="6" />
      <path d="M276 660 L440 440 L596 572 L752 352" fill="none" stroke="#f4f4f5" strokeOpacity=".92" strokeWidth="40" strokeLinecap="round" strokeLinejoin="round" />
      <g fill="#f4f4f5"><circle cx="276" cy="660" r="46" /><circle cx="440" cy="440" r="46" /><circle cx="596" cy="572" r="46" /></g>
      <circle cx="752" cy="352" r="58" fill="#fbbf24" />
    </svg>
  )
}

/** Sekme simgesi: favicon; yoksa ya da yuklenmezse alan adinin ilk harfi (renkli yuvarlak kare), bos sekmede kure */
import { useState } from 'react'
const hueOf = (s: string): number => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h }
export function TabIcon({ url, title, favicon }: { url: string; title: string; favicon?: string }) {
  const [bad, setBad] = useState(false)
  if (favicon && !bad) return <img className="tab-fav" alt="" src={favicon} onError={() => setBad(true)} />
  let host = ''
  try { host = new URL(url).hostname.replace(/^www\./, '') } catch { /* bos / gecersiz */ }
  if (!host) {
    return <svg className="tab-fav tab-fav-globe" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.2" aria-hidden><circle cx="8" cy="8" r="6.2" /><path d="M1.8 8h12.4M8 1.8c2 2 2 10.4 0 12.4M8 1.8c-2 2-2 10.4 0 12.4" /></svg>
  }
  const letter = (host[0] ?? title[0] ?? '?').toUpperCase()
  return <span className="tab-fav tab-fav-fb" aria-hidden style={{ background: `hsl(${hueOf(host)} 42% 42%)` }}>{letter}</span>
}
