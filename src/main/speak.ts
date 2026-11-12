import { execFile, spawn, type ChildProcess } from 'node:child_process'
import { parseVoices, pickVoice, speakable, type Voice } from '../shared/tts'
import { speakCommand, type SpeakCmd } from '../shared/ttscmd'

/** Sesli okuma: macOS `say`, Windows PowerShell (System.Speech), Linux espeak-ng/espeak/spd-say. Metin stdin'den (arguman enjeksiyonu yok); ayni anda tek okuma. */
export class Speaker {
  private proc: ChildProcess | null = null
  private voices: Voice[] | null = null
  constructor(private onState: (speaking: boolean) => void) {}
  get speaking(): boolean { return !!this.proc }

  private async loadVoices(): Promise<Voice[]> {
    if (this.voices) return this.voices
    if (process.platform !== 'darwin') { this.voices = []; return this.voices } // ses secimi yalniz macOS'ta (diger sistemlerde varsayilan ses)
    this.voices = await new Promise<Voice[]>((res) => execFile('say', ['-v', '?'], (_e, out) => res(parseVoices(String(out ?? '')))))
    return this.voices
  }

  /** komut adaylarini sirayla dener: ilki baslayan kazanir (Linux'ta kurulu olan motor) */
  private start(cands: SpeakCmd[], text: string, onDone: () => void): ChildProcess | null {
    const [c, ...rest] = cands; if (!c) return null
    const p = spawn(c.bin, c.args, { stdio: ['pipe', 'ignore', 'ignore'], windowsHide: true })
    p.on('error', () => { if (this.proc === p) { const next = this.start(rest, text, onDone); this.proc = next; if (!next) onDone() } })
    p.on('exit', () => { if (this.proc === p) onDone() })
    p.stdin?.on('error', () => { /* motor yok/erken bitti */ })
    p.stdin?.end(text)
    return p
  }

  /** Okumaya baslar (varsa onceki durdurulur); okunacak metin yoksa null */
  async speak(text: string, lang: string): Promise<{ voice: string | null; chars: number } | null> {
    const t = speakable(text); if (!t) return null
    this.stop()
    const v = pickVoice(await this.loadVoices(), lang)
    const done = (): void => { this.proc = null; this.onState(false) }
    this.proc = this.start(speakCommand(process.platform, { voice: v?.name ?? null }), t, done)
    if (!this.proc) return null
    this.onState(true)
    return { voice: v?.name ?? null, chars: t.length }
  }
  stop(): void { const p = this.proc; if (p) { this.proc = null; try { p.kill() } catch { /* bitmis */ } this.onState(false) } }
}
