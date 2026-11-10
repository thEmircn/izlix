import type { SVGProps } from 'react'

// Sade, tek renkli (currentColor) cizgi ikonlari. Emoji yok.
const base = (p: SVGProps<SVGSVGElement>): SVGProps<SVGSVGElement> => ({ width: 15, height: 15, viewBox: '0 0 16 16', fill: 'none', stroke: 'currentColor', strokeWidth: 1.5, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true, ...p })

export const Back = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M10 3.5 5.5 8l4.5 4.5" /></svg>
export const Forward = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M6 3.5 10.5 8 6 12.5" /></svg>
export const Reload = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M13 8a5 5 0 1 1-1.6-3.7" /><path d="M13 2.5v3h-3" /></svg>
export const Plus = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 3.5v9M3.5 8h9" /></svg>
export const Close = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 12, height: 12, ...p })}><path d="M4 4l8 8M12 4l-8 8" /></svg>
export const Star = ({ filled, ...p }: SVGProps<SVGSVGElement> & { filled?: boolean }) => <svg {...base({ fill: filled ? 'currentColor' : 'none', ...p })}><path d="M8 2.2l1.8 3.7 4 .6-2.9 2.8.7 4L8 11.4 4.4 13.3l.7-4L2.2 6.5l4-.6L8 2.2z" /></svg>
export const Download = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M8 2.5v7.5M4.8 7 8 10.2 11.2 7M3 13h10" /></svg>
export const Trash = (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d="M3 4.5h10M6.5 4.5V3h3v1.5M5 4.5l.6 8h4.8l.6-8" /></svg>
export const Spinner = (p: SVGProps<SVGSVGElement>) => <svg {...base({ width: 12, height: 12, ...p })} className="spin"><path d="M8 2.5a5.5 5.5 0 1 1-5.5 5.5" /></svg>
