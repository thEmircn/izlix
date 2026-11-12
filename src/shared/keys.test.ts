import { describe, expect, it } from 'vitest'
import { keyLabel } from './keys'

describe('keyLabel', () => {
  it('macOS: oldugu gibi', () => { expect(keyLabel('⇧⌘F', true)).toBe('⇧⌘F'); expect(keyLabel('⌘K', true)).toBe('⌘K') })
  it('Windows/Linux: okunur adlar, sabit sira', () => {
    expect(keyLabel('⌘K', false)).toBe('Ctrl+K'); expect(keyLabel('⇧⌘F', false)).toBe('Ctrl+Shift+F'); expect(keyLabel('⌥⌘1', false)).toBe('Ctrl+Alt+1')
    expect(keyLabel('⇧⌘B', false)).toBe('Ctrl+Shift+B'); expect(keyLabel('⌘,', false)).toBe('Ctrl+,')
  })
  it('simgesiz etiketler dokunulmaz', () => { expect(keyLabel('F11', false)).toBe('F11'); expect(keyLabel('https://x.com', false)).toBe('https://x.com'); expect(keyLabel('⇧F11', false)).toBe('Shift+F11') })
})
