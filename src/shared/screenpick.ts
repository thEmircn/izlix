export interface PickSource { id: string; name: string; display_id: string }
export interface PickDisplay { id: number; bounds: { x: number; y: number; width: number; height: number } }

/** Imlecin bulundugu ekranin kaynagini bulur (display_id eslesmesi; yoksa ekran sirasi). Ekran kaynagi yoksa null. */
export function screenAtPoint(sources: PickSource[], displays: PickDisplay[], p: { x: number; y: number }): PickSource | null {
  const screens = sources.filter((s) => s.id.startsWith('screen:'))
  if (!screens.length) return null
  const d = displays.find((x) => p.x >= x.bounds.x && p.x < x.bounds.x + x.bounds.width && p.y >= x.bounds.y && p.y < x.bounds.y + x.bounds.height) ?? displays[0]
  if (!d) return screens[0]
  const byId = screens.find((s) => s.display_id === String(d.id))
  if (byId) return byId
  const i = displays.findIndex((x) => x.id === d.id)
  return screens[i] ?? screens[0]
}
