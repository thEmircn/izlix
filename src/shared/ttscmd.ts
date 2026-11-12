/**
 * Platforma gore sesli okuma komutu (saf). Metin HER ZAMAN stdin'den verilir: arguman/komut enjeksiyonu yoktur.
 * macOS: `say`; Windows: PowerShell System.Speech (stdin'den okur); Linux: espeak-ng/espeak/spd-say (stdin).
 */
export interface SpeakCmd { bin: string; args: string[] }

export function speakCommand(platform: NodeJS.Platform | string, opts: { voice?: string | null; rate?: number } = {}): SpeakCmd[] {
  const rate = opts.rate ?? 185
  if (platform === 'darwin') return [{ bin: 'say', args: ['-r', String(rate), ...(opts.voice ? ['-v', opts.voice] : [])] }]
  if (platform === 'win32') {
    // PowerShell: stdin'den metni oku, varsayilan sesle konus (ses adi yalniz guvenli karakterlerse kullanilir)
    const wpm = Math.max(-10, Math.min(10, Math.round((rate - 175) / 15)))
    const voice = opts.voice && /^[\w .()-]{1,80}$/.test(opts.voice) ? `$s.SelectVoice('${opts.voice.replace(/'/g, "''")}');` : ''
    const script = `Add-Type -AssemblyName System.Speech; $s = New-Object System.Speech.Synthesis.SpeechSynthesizer; ${voice} $s.Rate = ${wpm}; $t = [Console]::In.ReadToEnd(); $s.Speak($t)`
    return [{ bin: 'powershell.exe', args: ['-NoProfile', '-NonInteractive', '-Command', script] }]
  }
  // Linux ve digerleri: espeak-ng, espeak, spd-say sirayla denenir (hepsi stdin'den okur)
  return [
    { bin: 'espeak-ng', args: ['--stdin', '-s', String(rate), ...(opts.voice ? ['-v', opts.voice] : [])] },
    { bin: 'espeak', args: ['--stdin', '-s', String(rate), ...(opts.voice ? ['-v', opts.voice] : [])] },
    { bin: 'spd-say', args: ['--wait', '-e', ...(opts.voice ? ['-l', opts.voice] : [])] }
  ]
}
