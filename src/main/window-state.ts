import { app, screen, type BrowserWindow, type Rectangle } from 'electron'
import { join } from 'node:path'
import { readFileSync, writeFileSync } from 'node:fs'

interface State { bounds: Rectangle; maximized: boolean }

/** Pencere boyut/konumunu hatirlar; kayitli konum artik bagli olmayan bir ekranda kaliyorsa varsayilana doner. */
export function restoreWindowState(defaults: { width: number; height: number }): { x?: number; y?: number; width: number; height: number; maximized: boolean } {
  try {
    const s: State = JSON.parse(readFileSync(join(app.getPath('userData'), 'window.json'), 'utf8'))
    const visible = screen.getAllDisplays().some((d) => {
      const a = d.workArea, b = s.bounds
      return b.x < a.x + a.width - 40 && b.x + b.width > a.x + 40 && b.y >= a.y - 10 && b.y < a.y + a.height - 40
    })
    if (visible && s.bounds.width >= 600 && s.bounds.height >= 400) return { ...s.bounds, maximized: s.maximized }
  } catch { /* ilk acilis */ }
  return { ...defaults, maximized: false }
}

export function trackWindowState(win: BrowserWindow): void {
  let timer: NodeJS.Timeout | null = null
  const save = (): void => {
    if (win.isDestroyed()) return
    try { writeFileSync(join(app.getPath('userData'), 'window.json'), JSON.stringify({ bounds: win.isMaximized() ? win.getNormalBounds() : win.getBounds(), maximized: win.isMaximized() } satisfies State)) } catch { /* disk hatasi */ }
  }
  const later = (): void => { if (timer) clearTimeout(timer); timer = setTimeout(save, 400) }
  for (const ev of ['resize', 'move', 'maximize', 'unmaximize'] as const) win.on(ev as any, later)
  win.on('close', save)
}
