import { describe, expect, it } from 'vitest'
import { editorCommand } from './editor'
describe('editorCommand', () => {
  it('VS Code/Cursor: yeni pencere, klasor + dosya:satir:sutun', () => {
    expect(editorCommand('vscode', { file: '/p/src/A.tsx', line: 31, column: 17, root: '/p' }).args).toEqual(['-n', '/p', '-g', '/p/src/A.tsx:31:17'])
    expect(editorCommand('cursor', { root: '/p' }).args).toEqual(['-n', '/p'])
    expect(editorCommand('vscode', { file: '/p/a.ts' }).args).toEqual(['-n', '-g', '/p/a.ts:1:1'])
    expect(editorCommand('vscode', { file: 'x' }).bins[0]).toContain('/code')
  })
  it('WebStorm farkli bayraklar', () => { expect(editorCommand('webstorm', { file: '/p/a.ts', line: 3, column: 2 }).args).toEqual(['--line', '3', '--column', '2', '/p/a.ts']) })
})
