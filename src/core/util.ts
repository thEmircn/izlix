const enc = new TextEncoder()
/** UTF-8 bayt uzunlugu (Node'a ozgu bayt sayaci yerine; tarayici/eklentide de calisir) */
export const utf8Length = (s: string): number => enc.encode(s).length
