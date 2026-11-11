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

// Panel rayi ikonlari
const ic = (d: string) => (p: SVGProps<SVGSVGElement>) => <svg {...base(p)}><path d={d} /></svg>
export const IcOverview = ic('M3 3h4v4H3zM9 3h4v4H9zM3 9h4v4H3zM9 9h4v4H9z')
export const IcTimeline = ic('M2 8.5h2.5l1.8-4.5 3 8 1.9-3.5H14')
export const IcNetwork = ic('M5 13V3M2.5 5.5 5 3l2.5 2.5M11 3v10M8.5 10.5 11 13l2.5-2.5')
export const IcConsole = ic('M3 4.5 7 8l-4 3.5M8.5 12H13')
export const IcElements = ic('M6 4 2.5 8 6 12M10 4l3.5 4-3.5 4')
export const IcSources = ic('M4 2.5h5l3 3v8H4zM9 2.5v3h3M6.2 8.5h3.6M6.2 10.8h3.6')
export const IcStorage = ic('M3 4.5C3 3.5 5.2 2.7 8 2.7s5 .8 5 1.8-2.2 1.8-5 1.8-5-.8-5-1.8zM3 4.5v7c0 1 2.2 1.8 5 1.8s5-.8 5-1.8v-7M3 8c0 1 2.2 1.8 5 1.8S13 9 13 8')
export const IcPerf = ic('M2.5 11.5a5.5 5.5 0 1 1 11 0M8 11.5l2.6-3.6')
export const IcCoverage = ic('M8 2.5a5.5 5.5 0 1 0 5.5 5.5H8zM10 2.8A5.5 5.5 0 0 1 13.2 6H10z')
export const IcA11y = ic('M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM5 6.5h6M8 6.5V9M6.5 12 8 9l1.5 3')
export const IcProfiler = ic('M2.5 3.5h11M2.5 6.8h7.5M2.5 10.1h9.5M2.5 13.4H7')
export const IcSeo = ic('M7 11.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9zM10.3 10.3l3.2 3.2')
export const IcServer = ic('M3 3.5h10v3.5H3zM3 9h10v3.5H3zM5.2 5.25h.01M5.2 10.75h.01')
export const IcComponents = ic('M8 2.5 13 5.2v5.6L8 13.5 3 10.8V5.2zM3 5.2 8 8l5-2.8M8 8v5.5')
export const IcRenders = ic('M9 2 4.2 9h3.3L7 14l4.8-7H8.5z')
export const IcStyle = ic('M8 2.5c3 0 5.5 2 5.5 4.6 0 1.6-1.2 2.4-2.6 2.4H9.6c-.8 0-1.2.7-.8 1.3.4.6.2 1.7-1 1.7C5 12.5 2.5 10.2 2.5 7.6 2.5 4.7 5 2.5 8 2.5zM5.5 7h.01M8 5.3h.01M10.5 7h.01')
export const IcPanel = ic('M2.5 3.5h11v9h-11zM9.5 3.5v9')
export const IcDockL = ic('M2.5 3.5h11v9h-11zM6.5 3.5v9')
export const IcDockB = ic('M2.5 3.5h11v9h-11zM2.5 9h11')
export const IcExpand = ic('M9.5 2.5h4v4M13.5 2.5 9 7M6.5 13.5h-4v-4M2.5 13.5 7 9')
export const IcRaw = ic('M3 4h10M3 8h10M3 12h6')
export const IcHome = ic('M2.5 7.5 8 3l5.5 4.5M4 6.8V13h8V6.8')
export const IcFolder = ic('M2.5 4.5h4l1.5 1.5h5.5v6.5h-11z')
export const IcServerDot = ic('M8 3v4M8 9v4M3 8h4M9 8h4')

export const IcGear = ic('M8 5.6a2.4 2.4 0 1 0 0 4.8 2.4 2.4 0 0 0 0-4.8zM8 1.8v1.6M8 12.6v1.6M1.8 8h1.6M12.6 8h1.6M3.6 3.6l1.1 1.1M11.3 11.3l1.1 1.1M3.6 12.4l1.1-1.1M11.3 4.7l1.1-1.1')
export const IcClock = ic('M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM8 5v3.2l2.2 1.3')
export const IcBookmark = ic('M4.5 2.5h7v11L8 10.8 4.5 13.5z')
export const IcLayers = ic('M8 2.5 13.5 5.5 8 8.5 2.5 5.5zM2.5 8.2 8 11.2l5.5-3M2.5 10.8 8 13.8l5.5-3')
export const IcSearch = ic('M7 2.5a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zM10.4 10.4 13.5 13.5')
export const IcArrow = ic('M3 8h9.5M8.5 4 12.5 8l-4 4')
export const IcGlobe = ic('M8 2.5a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM2.5 8h11M8 2.5c1.7 1.6 2.5 3.4 2.5 5.5S9.7 11.900 8 13.500C6.300 11.900 5.500 10.100 5.500 8S6.300 4.100 8 2.500z')
export const IcShield = ic('M8 2 3 4v4c0 3 2.200 5 5 6 2.800-1 5-3 5-6V4zM5.800 8l1.600 1.600L10.400 6.600')
export const IcHop = ic('M2.500 5h9M9 2.500 11.500 5 9 7.500M13.500 11h-9M7 8.500 4.500 11 7 13.500')
