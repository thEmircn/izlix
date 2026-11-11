import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { parseVoices, pickVoice, speakable, type Voice } from '../shared/tts'

/** Sesli okuma: macOS `say` (metin stdin'den: arguman enjeksiyonu yok); ayni anda tek okuma. */
export class Speaker {
  private proc: ChildProcess | null = null
  private voices: Voice[] | null = null
  constructor(private onState: (speaking: boolean) => void) {}
  get speaking(): boolean { return !!this.proc }

  private async loadVoices(): Promise<Voice[]> {
    if (this.voices) return this.voices
    this.voices = await new Promise<Voice[]>((res) => execFile('say', ['-v', '?'], (_e, out) => res(parseVoices(String(out ?? '')))))
    return this.voices
  }
  /** Okumaya baslar (varsa onceki durdurulur); okunacak metin yoksa false */
  async speak(text: string, lang: string): Promise<{ voice: string | null; chars: number } | null> {
    const t = speakable(text); if (!t) return null
    this.stop()
    const v = pickVoice(await this.loadVoices(), lang)
    const args = ['-r', '185', ...(v ? ['-v', v.name] : [])]
    const p = spawn('say', args, { stdio: ['pipe', 'ignore', 'ignore'] })
    this.proc = p; this.onState(true)
    p.on('exit', () => { if (this.proc === p) { this.proc = null; this.onState(false) } })
    p.on('error', () => { if (this.proc === p) { this.proc = null; this.onState(false) } })
    p.stdin?.end(t)
    return { voice: v?.name ?? null, chars: t.length }
  }
  stop(): void { const p = this.proc; if (p) { this.proc = null; try { p.kill() } catch { /* bitmis */ } this.onState(false) } }
}
