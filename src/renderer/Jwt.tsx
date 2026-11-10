import { useEffect, useState } from 'react'
import { expiryOf, humanDelta, type Jwt } from '../shared/jwt'
import { toast, useT } from './store'

const fmtDate = (sec?: number): string => (sec ? new Date(sec * 1000).toLocaleString() : '')

/** Cozulmus JWT kartlari: baslik, yuk, talepler (claims) ve canli gecerlilik sayaci. */
export function JwtList({ jwts }: { jwts: Jwt[] }) {
  const t = useT()
  const [, tick] = useState(0)
  useEffect(() => { const h = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(h) }, [])
  if (!jwts.length) return null
  return (
    <section className="kv jwt">
      <h4>{t('jwt.title')} ({jwts.length})</h4>
      {jwts.map((j, i) => {
        const ex = expiryOf(j)
        return (
          <div key={i} className={`jwtcard ${ex.state}`}>
            <div className="jhead">
              <b>{String(j.header.alg ?? '?')}</b>
              <span className="jbadge">{ex.state === 'none' ? t('jwt.noExp') : ex.state === 'valid' ? t('jwt.validFor', { d: humanDelta(ex.deltaSec) }) : ex.state === 'expired' ? t('jwt.expired', { d: humanDelta(ex.deltaSec) }) : t('jwt.notYet', { d: humanDelta(ex.deltaSec) })}</span>
              <button className="link" onClick={() => { void navigator.clipboard?.writeText(j.raw); toast(t('toast.copied')) }}>{t('jwt.copy')}</button>
            </div>
            <div className="jclaims">
              {Object.entries(j.payload).map(([k, v]) => (
                <div key={k}><span>{k}</span><code>{typeof v === 'object' ? JSON.stringify(v) : String(v)}{['exp', 'iat', 'nbf'].includes(k) && typeof v === 'number' ? `  (${fmtDate(v)})` : ''}</code></div>
              ))}
            </div>
            <div className="jnote">{t('jwt.unverified')}</div>
          </div>
        )
      })}
    </section>
  )
}
