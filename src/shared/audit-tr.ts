import type { Language } from './events'

/** Sayfa icinde calisan denetim betiginin Ingilizce mesajlarini Turkceye cevirir (bilinmeyen mesaj aynen doner). */
const RULES: [RegExp, (m: RegExpMatchArray) => string][] = [
  [/^Image has no alt attribute$/, () => 'Görselde alt özniteliği yok'],
  [/^Has no accessible name$/, () => 'Erişilebilir adı yok'],
  [/^Form control has no label$/, () => 'Form öğesinin etiketi yok'],
  [/^<html> has no lang attribute$/, () => '<html> öğesinde lang özniteliği yok'],
  [/^Page has no <title>$/, () => 'Sayfada <title> yok'],
  [/^No <main> landmark$/, () => '<main> bölgesi yok'],
  [/^Heading level jumps from h(\d) to h(\d)$/, (m) => `Başlık seviyesi h${m[1]}'den h${m[2]}'ye atlıyor`],
  [/^No <h1> heading$/, () => '<h1> başlığı yok'],
  [/^Duplicate id "(.*)"$/, (m) => `Yinelenen id "${m[1]}"`],
  [/^Positive tabindex disrupts focus order$/, () => 'Pozitif tabindex odak sırasını bozar'],
  [/^Click target is (\d+)×(\d+)px \(min 24×24\)$/, (m) => `Tıklama hedefi ${m[1]}×${m[2]}px (en az 24×24)`],
  [/^No <meta name="viewport">: mobile layout will be a zoomed-out desktop page$/, () => '<meta name="viewport"> yok: mobil görünüm uzaklaştırılmış masaüstü sayfası olur'],
  [/^Image has no width\/height attributes \(layout shift risk\)$/, () => 'Görselde width/height yok (yerleşim kayması riski)'],
  [/^Extends (\d+)px beyond the viewport \(horizontal scroll\)$/, (m) => `Görünür alanın ${m[1]}px dışına taşıyor (yatay kaydırma)`],
  [/^Contrast ([\d.]+):1 \(needs ([\d.]+):1\)$/, (m) => `Kontrast ${m[1]}:1 (gereken ${m[2]}:1)`]
]

export function trAudit(msg: string, lang: Language): string {
  if (lang !== 'tr') return msg
  for (const [re, fn] of RULES) { const m = msg.match(re); if (m) return fn(m) }
  return msg
}
