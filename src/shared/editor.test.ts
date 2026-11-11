import { describe, expect, it } from 'vitest'
import { editorCommand, editorUrl, isSafeSourcePath } from './editor'
describe('editorCommand', () => {
  it('VS Code/Cursor: yeni pencere, klasor + dosya:satir:sutun', () => {
    expect(editorCommand('vscode', { file: '/p/src/A.tsx', line: 31, column: 17, root: '/p' }).args).toEqual(['-n', '/p', '-g', '/p/src/A.tsx:31:17'])
    expect(editorCommand('cursor', { root: '/p' }).args).toEqual(['-n', '/p'])
    expect(editorCommand('vscode', { file: '/p/a.ts' }).args).toEqual(['-n', '-g', '/p/a.ts:1:1'])
    expect(editorCommand('vscode', { file: 'x' }).bins[0]).toContain('/code')
  })
  it('WebStorm farkli bayraklar', () => { expect(editorCommand('webstorm', { file: '/p/a.ts', line: 3, column: 2 }).args).toEqual(['--line', '3', '--column', '2', '/p/a.ts']) })
})

describe('editorUrl ve isSafeSourcePath', () => {
  it('URL semalari', () => {
    expect(editorUrl('vscode', '/a/b c.tsx', 3, 4)).toBe('vscode://file/a/b%20c.tsx:3:4')
    expect(editorUrl('webstorm', '/a/b.tsx', 3, 4)).toBe('webstorm://open?file=%2Fa%2Fb.tsx&line=3&column=4')
  })
  it('yalniz mutlak ve .. icermeyen yollar guvenli', () => {
    expect(isSafeSourcePath('/Users/x/proj/src/App.tsx')).toBe(true); expect(isSafeSourcePath('C:\\proj\\src\\App.tsx')).toBe(true)
    expect(isSafeSourcePath('src/App.tsx')).toBe(false); expect(isSafeSourcePath('/a/../etc/passwd')).toBe(false); expect(isSafeSourcePath('/a\0b')).toBe(false); expect(isSafeSourcePath('')).toBe(false)
  })
})
