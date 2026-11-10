import { type CSSProperties, type ReactNode } from 'react'

// Sade yardimci bilesenler: hover'da hafifce belirginlesen kart ve tus etiketi.

/** Hover'da hafifce belirginlesen kart */
export function Spotlight({ children, className = '', onClick, style, selected }: { children: ReactNode; className?: string; onClick?: () => void; style?: CSSProperties; selected?: boolean }) {
  return <div className={`spot ${selected ? 'sel' : ''} ${className}`} onClick={onClick} style={style}>{children}</div>
}

export const Kbd = ({ children }: { children: ReactNode }) => <kbd className="kbd">{children}</kbd>
