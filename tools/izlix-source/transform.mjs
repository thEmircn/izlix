// "Hassas mod" donusumu: gelistirme derlemesinde her ust duzey React bileseninin tanim yerini (dosya:satir:sutun)
// bilesene `__izlix_src` ozelligi olarak ekler. Dosyanin SONUNA kod eklendigi icin mevcut satirlar/source map kaymaz.
// Cikti yalnizca dev derlemelerinde kullanilmali (production'a eklenmemeli).
import { parse } from '@babel/parser'
import MagicString from 'magic-string'

const isComponentName = (n) => /^[A-Z]/.test(n)

// memo(function X(){}), forwardRef((p, r) => ...), React.memo(...) gibi sarmalayicilar bilesen sayilir
function isComponentInit(init) {
  if (!init) return false
  if (init.type === 'ArrowFunctionExpression' || init.type === 'FunctionExpression' || init.type === 'ClassExpression') return true
  if (init.type === 'CallExpression') {
    const c = init.callee
    const name = c.type === 'Identifier' ? c.name : c.type === 'MemberExpression' && c.property.type === 'Identifier' ? c.property.name : ''
    return ['memo', 'forwardRef', 'observer', 'lazy'].includes(name) || init.arguments.some((a) => a.type === 'ArrowFunctionExpression' || a.type === 'FunctionExpression')
  }
  return false
}

/** @returns {{ code: string, map: object, count: number } | null} */
export function annotate(code, filename) {
  let ast
  try { ast = parse(code, { sourceType: 'module', plugins: ['jsx', 'typescript'], errorRecovery: true }) } catch { return null }
  const found = []
  const visit = (node) => {
    if (!node) return
    if ((node.type === 'FunctionDeclaration' || node.type === 'ClassDeclaration') && node.id && isComponentName(node.id.name)) {
      found.push({ name: node.id.name, loc: node.id.loc.start })
    } else if (node.type === 'VariableDeclaration') {
      for (const d of node.declarations) {
        if (d.id.type === 'Identifier' && isComponentName(d.id.name) && isComponentInit(d.init)) found.push({ name: d.id.name, loc: d.id.loc.start })
      }
    } else if (node.type === 'ExportNamedDeclaration' || node.type === 'ExportDefaultDeclaration') {
      visit(node.declaration)
    }
  }
  for (const stmt of ast.program.body) visit(stmt)
  if (!found.length) return null
  const file = filename.split('?')[0]
  const ms = new MagicString(code)
  const lines = found.map((f) => `try{Object.defineProperty(${f.name},"__izlix_src",{value:${JSON.stringify(`${file}:${f.loc.line}:${f.loc.column + 1}`)},configurable:true})}catch(e){}`)
  ms.append(`\n/* izlix-source */\n${lines.join('\n')}\n`)
  return { code: ms.toString(), map: ms.generateMap({ hires: true, source: file }), count: found.length }
}
