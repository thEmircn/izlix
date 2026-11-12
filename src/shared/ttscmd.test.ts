import { describe, expect, it } from 'vitest'
import { speakCommand } from './ttscmd'

describe('speakCommand', () => {
  it('macOS: say, ses ve hiz', () => { expect(speakCommand('darwin', { voice: 'Yelda' })).toEqual([{ bin: 'say', args: ['-r', '185', '-v', 'Yelda'] }]) })
  it('Windows: PowerShell, metin stdin\'den; tehlikeli ses adi yok sayilir', () => {
    const [c] = speakCommand('win32', { voice: "Evil'; calc; '" })
    expect(c.bin).toBe('powershell.exe'); expect(c.args.join(' ')).toContain('[Console]::In.ReadToEnd()'); expect(c.args.join(' ')).not.toContain('calc')
    expect(speakCommand('win32', { voice: 'Microsoft David Desktop' })[0].args.join(' ')).toContain("SelectVoice('Microsoft David Desktop')")
  })
  it('Linux: espeak-ng, espeak, spd-say sirayla (hepsi stdin)', () => {
    const l = speakCommand('linux'); expect(l.map((c) => c.bin)).toEqual(['espeak-ng', 'espeak', 'spd-say']); expect(l[0].args).toContain('--stdin')
  })
})
