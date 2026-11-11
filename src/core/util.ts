const enc = new TextEncoder()
/** UTF-8 bayt uzunlugu (Node'a ozgu bayt sayaci yerine; tarayici/eklentide de calisir) */
export const utf8Length = (s: string): number => enc.encode(s).length

/** UTF-8 metni base64'e cevirir (Node'un Buffer'i yerine; buyuk govdelerde yigin tasmasini onlemek icin parcali) */
export function utf8ToBase64(s: string): string {
  const bytes = enc.encode(s); let bin = ''
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(bin)
}
