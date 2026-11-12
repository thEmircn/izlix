/**
 * Kisayol etiketleri: macOS simgeleri (⌘ ⌥ ⇧ ⌃) Windows/Linux'ta okunur adlara cevrilir ("⇧⌘F" -> "Ctrl+Shift+F").
 * Kisayol islevi main surecteki menu hizlandiricilariyla ("CmdOrCtrl+...") zaten her platformda calisir; bu yalniz gosterimdir.
 */
const MODS: Record<string, string> = { '⌘': 'Ctrl', '⌃': 'Ctrl', '⌥': 'Alt', '⇧': 'Shift' }
const ORDER = ['Ctrl', 'Alt', 'Shift']

export function keyLabel(label: string, mac: boolean): string {
  if (mac || !/^[⌘⌃⌥⇧]/.test(label)) return label
  const mods = new Set<string>(); let i = 0
  while (i < label.length && MODS[label[i]]) { mods.add(MODS[label[i]]); i++ }
  const key = label.slice(i)
  return [...ORDER.filter((m) => mods.has(m)), key].filter(Boolean).join('+')
}
