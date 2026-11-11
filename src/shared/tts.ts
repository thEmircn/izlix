// Sesli okuma (macOS `say`): ses listesi ayristirma ve dile gore secim (saf).
export interface Voice { name: string; locale: string }
/** `say -v '?'` ciktisi: "Yelda               tr_TR    # Merhaba..." */
export function parseVoices(out: string): Voice[] {
  const v: Voice[] = []
  for (const line of out.split('\n')) { const m = /^(.+?)\s+([a-z]{2}_[A-Z]{2})\s+#/.exec(line); if (m) v.push({ name: m[1].trim(), locale: m[2] }) }
  return v
}
const PREFER: Record<string, string[]> = { tr: ['Yelda', 'Cem'], en: ['Samantha', 'Daniel', 'Alex'] }
/** Dil kodu (2 harf) icin en uygun ses; yoksa Ingilizce, o da yoksa ilk ses */
export function pickVoice(voices: Voice[], lang: string): Voice | null {
  const l = (lang || 'en').slice(0, 2).toLowerCase()
  const inLang = voices.filter((v) => v.locale.toLowerCase().startsWith(l + '_'))
  const pref = (PREFER[l] ?? []).map((n) => inLang.find((v) => v.name === n)).find(Boolean)
  return pref ?? inLang[0] ?? (l !== 'en' ? pickVoice(voices, 'en') : null) ?? voices[0] ?? null
}
/** Okunacak metni temizler (cok uzun metni keser, bosluklari normallestirir) */
export const speakable = (t: string, max = 30000): string => t.replace(/\s+/g, ' ').trim().slice(0, max)
