// Style Lab: canli yapilan stil degisikliklerini koda geri tasimak icin CSS kurali ve Tailwind sinifi uretir. Saf mantik.
export type Props = Record<string, string>

export function parseInline(style: string): Props {
  const out: Props = {}
  for (const decl of style.split(';')) {
    const i = decl.indexOf(':'); if (i < 0) continue
    const k = decl.slice(0, i).trim().toLowerCase(), v = decl.slice(i + 1).trim()
    if (k && v) out[k] = v
  }
  return out
}
export const stringifyInline = (p: Props): string => Object.entries(p).map(([k, v]) => `${k}: ${v}`).join('; ')

/** "12px" / "12" -> 12; baska birimde null */
export function px(v: string | undefined): number | null {
  if (v == null) return null
  const m = v.trim().match(/^(-?\d*\.?\d+)(px)?$/)
  return m ? parseFloat(m[1]) : null
}

export function rgbToHex(c: string): string {
  const m = c.match(/rgba?\(([^)]+)\)/); if (!m) return /^#[0-9a-f]{3,8}$/i.test(c) ? c : '#000000'
  const p = m[1].split(/[ ,\/]+/).filter(Boolean).map(Number)
  return '#' + [p[0], p[1], p[2]].map((n) => Math.max(0, Math.min(255, Math.round(n || 0))).toString(16).padStart(2, '0')).join('')
}

export function cssRule(selector: string, changes: Props): string {
  const body = Object.entries(changes).map(([k, v]) => `  ${k}: ${v};`).join('\n')
  return body ? `${selector} {\n${body}\n}` : ''
}

const SPACING = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5, 4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 16, 20, 24, 28, 32, 36, 40, 44, 48, 52, 56, 60, 64, 72, 80, 96]
const sp = (n: number): string => { if (n === 1) return 'px'; const u = n / 4; return SPACING.includes(u) ? String(u) : `[${n}px]` }
const FONT = new Map([[12, 'xs'], [14, 'sm'], [16, 'base'], [18, 'lg'], [20, 'xl'], [24, '2xl'], [30, '3xl'], [36, '4xl'], [48, '5xl'], [60, '6xl']])
const WEIGHT = new Map([['100', 'thin'], ['200', 'extralight'], ['300', 'light'], ['400', 'normal'], ['500', 'medium'], ['600', 'semibold'], ['700', 'bold'], ['800', 'extrabold'], ['900', 'black']])
const LEADING = new Map([['1', 'none'], ['1.25', 'tight'], ['1.375', 'snug'], ['1.5', 'normal'], ['1.625', 'relaxed'], ['2', 'loose']])
const RADIUS = new Map([[0, 'none'], [2, 'sm'], [4, ''], [6, 'md'], [8, 'lg'], [12, 'xl'], [16, '2xl'], [24, '3xl'], [9999, 'full']])
const OPACITY = [0, 5, 10, 20, 25, 30, 40, 50, 60, 70, 75, 80, 90, 95, 100]
const DISPLAY: Props = { block: 'block', flex: 'flex', grid: 'grid', inline: 'inline', 'inline-block': 'inline-block', 'inline-flex': 'inline-flex', none: 'hidden' }
const DIR: Props = { row: 'flex-row', column: 'flex-col', 'row-reverse': 'flex-row-reverse', 'column-reverse': 'flex-col-reverse' }
const JUSTIFY: Props = { 'flex-start': 'justify-start', center: 'justify-center', 'flex-end': 'justify-end', 'space-between': 'justify-between', 'space-around': 'justify-around', 'space-evenly': 'justify-evenly' }
const ITEMS: Props = { 'flex-start': 'items-start', center: 'items-center', 'flex-end': 'items-end', stretch: 'items-stretch', baseline: 'items-baseline' }
const ALIGN: Props = { left: 'text-left', center: 'text-center', right: 'text-right', justify: 'text-justify' }
const SHADOW: Props = { none: 'shadow-none', '0 1px 2px rgba(0,0,0,.2)': 'shadow-sm', '0 4px 6px rgba(0,0,0,.25)': 'shadow-md', '0 10px 15px rgba(0,0,0,.3)': 'shadow-lg' }

function box(prefix: 'p' | 'm', get: (side: string) => string | undefined, used: Set<string>): string[] {
  const names = prefix === 'p' ? 'padding' : 'margin'
  const v = (['top', 'right', 'bottom', 'left'] as const).map((s) => px(get(`${names}-${s}`)))
  if (v.every((x) => x == null)) return []
  const [t, r, b, l] = v
  const mark = (): void => ['top', 'right', 'bottom', 'left'].forEach((s) => used.add(`${names}-${s}`))
  const cls = (pre: string, n: number | null): string | null => (n == null ? null : `${pre}-${sp(n)}`)
  if (v.every((x) => x != null)) {
    mark()
    if (t === r && r === b && b === l) return [cls(prefix, t)!]
    if (t === b && l === r) return [cls(`${prefix}y`, t)!, cls(`${prefix}x`, l)!]
    return [cls(`${prefix}t`, t)!, cls(`${prefix}r`, r)!, cls(`${prefix}b`, b)!, cls(`${prefix}l`, l)!]
  }
  const out: string[] = []
  ;([['top', 't', t], ['right', 'r', r], ['bottom', 'b', b], ['left', 'l', l]] as const).forEach(([s, ch, n]) => { if (n != null) { used.add(`${names}-${s}`); out.push(cls(`${prefix}${ch}`, n)!) } })
  return out
}

/** Degisen ozelliklerden Tailwind siniflari; karsiligi olmayanlar `unmapped`ta kalir (ham CSS olarak). */
export function toTailwind(changes: Props): { classes: string[]; unmapped: Props } {
  const used = new Set<string>(), classes: string[] = []
  const get = (k: string): string | undefined => changes[k]
  classes.push(...box('p', get, used), ...box('m', get, used))
  for (const [k, v] of Object.entries(changes)) {
    if (used.has(k)) continue
    const n = px(v)
    let c: string | undefined
    switch (k) {
      case 'width': c = n != null ? `w-${sp(n)}` : v === '100%' ? 'w-full' : v === 'auto' ? 'w-auto' : `w-[${v.replace(/\s/g, '_')}]`; break
      case 'height': c = n != null ? `h-${sp(n)}` : v === '100%' ? 'h-full' : v === 'auto' ? 'h-auto' : `h-[${v.replace(/\s/g, '_')}]`; break
      case 'gap': c = n != null ? `gap-${sp(n)}` : undefined; break
      case 'font-size': c = n != null ? (FONT.has(n) ? `text-${FONT.get(n)}` : `text-[${n}px]`) : undefined; break
      case 'font-weight': c = WEIGHT.has(v) ? `font-${WEIGHT.get(v)}` : undefined; break
      case 'line-height': c = LEADING.has(v) ? `leading-${LEADING.get(v)}` : n != null ? `leading-[${n}px]` : `leading-[${v}]`; break
      case 'letter-spacing': c = `tracking-[${v}]`; break
      case 'color': c = `text-[${v.replace(/\s/g, '')}]`; break
      case 'background-color': c = `bg-[${v.replace(/\s/g, '')}]`; break
      case 'border-radius': c = n != null ? (RADIUS.has(n) ? (RADIUS.get(n) ? `rounded-${RADIUS.get(n)}` : 'rounded') : `rounded-[${n}px]`) : undefined; break
      case 'opacity': { const o = Math.round(parseFloat(v) * 100); c = OPACITY.includes(o) ? `opacity-${o}` : `opacity-[${v}]`; break }
      case 'display': c = DISPLAY[v]; break
      case 'flex-direction': c = DIR[v]; break
      case 'justify-content': c = JUSTIFY[v]; break
      case 'align-items': c = ITEMS[v]; break
      case 'text-align': c = ALIGN[v]; break
      case 'box-shadow': c = SHADOW[v]; break
    }
    if (c) { classes.push(c); used.add(k) }
  }
  const unmapped: Props = {}
  for (const [k, v] of Object.entries(changes)) if (!used.has(k)) unmapped[k] = v
  return { classes, unmapped }
}
