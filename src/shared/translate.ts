// Sayfa cevirisi: Google'in kendi sayfa ceviri adresi (kullanici acikca isteyince; adres Google'a gider).
export const translateUrl = (url: string, lang: string): string => `https://translate.google.com/translate?sl=auto&tl=${encodeURIComponent(lang)}&u=${encodeURIComponent(url)}`
/** Ceviri sayfasiysa asil adresi (ceviriyi kapatmak icin), degilse null */
export function originalFromTranslate(url: string): string | null {
  try { const u = new URL(url); if (u.hostname === 'translate.google.com' && u.pathname === '/translate') { const o = u.searchParams.get('u'); return o && /^https?:/.test(o) ? o : null } } catch { /* gecersiz */ }
  return null
}
