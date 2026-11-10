import { describe, expect, it } from 'vitest'
// @ts-expect-error saf ESM modul
import { annotate } from './transform.mjs'

const src = `import { memo, forwardRef } from 'react'
export function List() { return null }
const Row = memo(function Row() { return null })
export const Input = forwardRef((p, r) => <input ref={r} />)
const Arrow = () => <div />
class Legacy extends Component { render() { return null } }
function helper() {}
const value = 3
export default function Page() { function Inner() {} return null }
`
describe('annotate', () => {
  const r = annotate(src, '/p/src/A.tsx')!
  const names = [...r.code.matchAll(/defineProperty\((\w+),/g)].map((m: RegExpMatchArray) => m[1])
  it('ust duzey bilesenleri bulur; kucuk harfli yardimcilari, degerleri ve ic ice tanimlari atlar', () => {
    expect(names).toEqual(['List', 'Row', 'Input', 'Arrow', 'Legacy', 'Page'])
  })
  it('konum 1-bazli dosya:satir:sutun', () => {
    expect(r.code).toContain('"/p/src/A.tsx:2:17"') // List: satir 2, "export function " sonrasi
    expect(r.code).toContain('"/p/src/A.tsx:9:25"') // Page
  })
  it('mevcut kodu degistirmez, yalniz sona ekler (satirlar kaymaz)', () => {
    expect(r.code.startsWith(src)).toBe(true)
  })
  it('bilesen yoksa veya sozdizimi cozulemezse null', () => {
    expect(annotate('const a = 1', '/x.ts')).toBeNull()
    expect(annotate('const = ;;; <<<', '/x.ts')).toBeNull()
  })
})
