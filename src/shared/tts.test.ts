import { describe, expect, it } from 'vitest'
import { parseVoices, pickVoice, speakable } from './tts'
const OUT = `Albert              en_US    # Hello! My name is Albert.
Yelda               tr_TR    # Merhaba! Benim adim Yelda.
Samantha            en_US    # Hello! My name is Samantha.
Thomas              fr_FR    # Bonjour !
Eddy (English (US)) en_US    # Hello! My name is Eddy.`
describe('tts', () => {
  it('parseVoices: ad (bosluklu/parantezli olabilir) + yerel', () => {
    const v = parseVoices(OUT); expect(v).toHaveLength(5); expect(v[1]).toEqual({ name: 'Yelda', locale: 'tr_TR' }); expect(v[4].name).toBe('Eddy (English (US))')
  })
  it('pickVoice: dile gore, tercih listesi, yedek Ingilizce', () => {
    const v = parseVoices(OUT)
    expect(pickVoice(v, 'tr')?.name).toBe('Yelda'); expect(pickVoice(v, 'en')?.name).toBe('Samantha'); expect(pickVoice(v, 'fr')?.name).toBe('Thomas'); expect(pickVoice(v, 'de')?.name).toBe('Samantha')
    expect(pickVoice([], 'tr')).toBeNull(); expect(pickVoice(v.slice(0, 1), 'tr')?.name).toBe('Albert')
  })
  it('speakable', () => { expect(speakable('  a \n\n b  ')).toBe('a b'); expect(speakable('x'.repeat(50), 10)).toHaveLength(10) })
})
