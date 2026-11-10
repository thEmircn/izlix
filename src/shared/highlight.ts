// Kucuk sozdizimi renklendirici (JS/TS/JSX/JSON/CSS): satir satir, blok yorumu durumunu satirlar arasi tasir.
export type TokType = 'kw' | 'str' | 'com' | 'num' | 'fn' | 'plain'
export interface Tok { t: TokType; s: string }
export type HlState = { block: boolean }

const KW = new Set('abstract as async await break case catch class const continue debugger default delete do else enum export extends false finally for from function get if implements import in instanceof interface let new null of private protected public readonly return set static super switch this throw true try type typeof undefined var void while with yield'.split(' '))
const CSS_AT = /^@[\w-]+/

export const initState = (): HlState => ({ block: false })

/** Tek satiri parcalar. `lang`: 'css' ise anahtar kelime yok. State gunceller (blok yorum). */
export function highlightLine(line: string, st: HlState, lang: 'js' | 'css' | 'json' | 'text' = 'js'): Tok[] {
  if (lang === 'text' || line.length > 2000) return [{ t: 'plain', s: line }] // cok uzun (minify) satirlar renklendirilmez
  const out: Tok[] = []
  let i = 0
  const push = (t: TokType, s: string): void => { if (!s) return; const last = out[out.length - 1]; if (last && last.t === t) last.s += s; else out.push({ t, s }) }
  while (i < line.length) {
    if (st.block) { const e = line.indexOf('*/', i); if (e < 0) { push('com', line.slice(i)); return out } push('com', line.slice(i, e + 2)); i = e + 2; st.block = false; continue }
    const c = line[i], n = line[i + 1]
    if (c === '/' && n === '*') { st.block = true; push('com', '/*'); i += 2; continue }
    if (lang !== 'json' && c === '/' && n === '/') { push('com', line.slice(i)); return out }
    if (c === '"' || c === "'" || c === '`') {
      let j = i + 1
      while (j < line.length && line[j] !== c) { if (line[j] === '\\') j++; j++ }
      push('str', line.slice(i, Math.min(j + 1, line.length))); i = j + 1; continue
    }
    if (/[0-9]/.test(c) && !/[\w$]/.test(line[i - 1] ?? '')) { const m = /^(0x[0-9a-f]+|\d+(\.\d+)?(e[+-]?\d+)?)/i.exec(line.slice(i)); if (m) { push('num', m[0]); i += m[0].length; continue } }
    if (lang === 'css' && c === '@') { const m = CSS_AT.exec(line.slice(i)); if (m) { push('kw', m[0]); i += m[0].length; continue } }
    if (/[A-Za-z_$]/.test(c)) {
      let j = i + 1; while (j < line.length && /[\w$-]/.test(line[j]) && !(lang !== 'css' && line[j] === '-')) j++
      const w = line.slice(i, j)
      if (lang === 'js' && KW.has(w)) push('kw', w)
      else if (lang === 'js' && line[j] === '(') push('fn', w)
      else push('plain', w)
      i = j; continue
    }
    push('plain', c); i++
  }
  return out
}

export const langOf = (name: string): 'js' | 'css' | 'json' | 'text' => /\.(m?[jt]sx?|vue|svelte)(\?|$)/i.test(name) ? 'js' : /\.(s?css|less)(\?|$)/i.test(name) ? 'css' : /\.(json|map)(\?|$)/i.test(name) ? 'json' : /\.(html?|txt|md)(\?|$)/i.test(name) ? 'text' : 'js'
